"""
Test / evaluate the trained SAR flood U-Net on held-out Sen1Floods11 chips.

What this does:
1. Rebuilds the exact same train/val/test split used during training
   (same seed), so we evaluate on the same 90 test tiles the model never
   trained or validated on.
2. Reloads the saved model, including its custom loss/metric functions.
3. Reports overall test IoU (sanity check against the ~0.50 seen during
   training).
4. Saves a handful of side-by-side images: SAR input | ground truth |
   model prediction, so you can visually inspect real examples.

Run from inside flashflood-layer4 with sar_env active:
    pip install matplotlib --break-system-packages
    python test_model.py
"""

import os
import glob
import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt
import rasterio

# ---------------------------------------------------------------------------
# Config — must match training script exactly for the split to line up
# ---------------------------------------------------------------------------
SAR_DIR = "HandLabeled/S1Hand"
LABEL_DIR = "HandLabeled/LabelHand"
MODEL_PATH = "best_sar_unet.keras"
OUTPUT_DIR = "test_predictions"
IMG_SIZE = 512
TEST_SPLIT = 90 / 446
VAL_SPLIT = 89 / 446
SEED = 42
NUM_EXAMPLES_TO_VISUALIZE = 6


# ---------------------------------------------------------------------------
# Same data pairing/loading logic as the training script
# ---------------------------------------------------------------------------
def get_pairs(sar_dir, label_dir):
    sar_files = sorted(glob.glob(os.path.join(sar_dir, "*.tif")))
    pairs = []
    for sar_path in sar_files:
        base = os.path.basename(sar_path).replace("_S1Hand.tif", "")
        label_path = os.path.join(label_dir, f"{base}_LabelHand.tif")
        if os.path.exists(label_path):
            pairs.append((sar_path, label_path))
    return pairs


def read_tif(path):
    with rasterio.open(path) as src:
        return src.read()


def normalize_vv_vh(sar_arr):
    sar_arr = np.nan_to_num(sar_arr, nan=-50.0, posinf=1.0, neginf=-50.0)
    sar_arr = np.clip(sar_arr, -50.0, 1.0)
    out = np.zeros_like(sar_arr, dtype=np.float32)
    for c in range(sar_arr.shape[0]):
        band = sar_arr[c]
        mn, mx = band.min(), band.max()
        out[c] = (band - mn) / (mx - mn + 1e-6)
    return out


def get_test_pairs(sar_dir, label_dir):
    pairs = get_pairs(sar_dir, label_dir)
    split_file = "test_split.json"
    if os.path.exists(split_file):
        import json
        with open(split_file) as f:
            test_names = set(json.load(f))
        test_pairs = [p for p in pairs if os.path.basename(p[0]) in test_names]
        print(f"Loaded exact test split from {split_file} ({len(test_pairs)} tiles)")
        return test_pairs
    else:
        print(f"WARNING: {split_file} not found — recomputing the split from "
              f"scratch. This may NOT match the exact test set used during "
              f"training if the underlying file listing differs at all "
              f"(e.g. a different HandLabeled download). Results may not "
              f"exactly match training's reported test IoU. Re-run training "
              f"with the updated script to generate test_split.json for a "
              f"guaranteed-reproducible test set going forward.")
        rng = np.random.default_rng(SEED)
        rng.shuffle(pairs)
        n = len(pairs)
        n_test = int(round(n * TEST_SPLIT))
        return pairs[:n_test]


def load_sample(sar_path, label_path):
    sar = read_tif(sar_path)
    label = read_tif(label_path)
    sar = normalize_vv_vh(sar)
    sar = np.transpose(sar, (1, 2, 0))          # (H, W, 2)
    label = label[0].astype(np.float32)          # (H, W)
    return sar, label


# ---------------------------------------------------------------------------
# Custom loss/metric functions — must match training script so the saved
# model can be reloaded (Keras needs these registered to deserialize it)
# ---------------------------------------------------------------------------
WATER_CLASS_WEIGHT = 5.0


def masked_weighted_bce(y_true, y_pred):
    mask = tf.cast(tf.not_equal(y_true, -1.0), tf.float32)
    y_true_safe = tf.clip_by_value(y_true, 0.0, 1.0)
    bce = tf.keras.losses.binary_crossentropy(y_true_safe, y_pred)
    bce = tf.expand_dims(bce, axis=-1)
    weights = 1.0 + y_true_safe * (WATER_CLASS_WEIGHT - 1.0)
    masked = bce * mask * weights
    return tf.reduce_sum(masked) / (tf.reduce_sum(mask * weights) + 1e-6)


def masked_dice_loss(y_true, y_pred, smooth=1.0):
    mask = tf.cast(tf.not_equal(y_true, -1.0), tf.float32)
    y_true_safe = tf.clip_by_value(y_true, 0.0, 1.0) * mask
    y_pred_masked = y_pred * mask
    intersection = tf.reduce_sum(y_true_safe * y_pred_masked)
    denom = tf.reduce_sum(y_true_safe) + tf.reduce_sum(y_pred_masked)
    dice_coef = (2.0 * intersection + smooth) / (denom + smooth)
    return 1.0 - dice_coef


def combined_loss(y_true, y_pred):
    return masked_weighted_bce(y_true, y_pred) + masked_dice_loss(y_true, y_pred)


def masked_iou(y_true, y_pred, threshold=0.5):
    mask = tf.cast(tf.not_equal(y_true, -1.0), tf.float32)
    y_true_safe = tf.clip_by_value(y_true, 0.0, 1.0)
    y_pred_bin = tf.cast(y_pred > threshold, tf.float32)
    intersection = tf.reduce_sum(y_true_safe * y_pred_bin * mask)
    union = tf.reduce_sum(
        tf.clip_by_value(y_true_safe + y_pred_bin, 0.0, 1.0) * mask
    )
    return intersection / (union + 1e-6)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    test_pairs = get_test_pairs(SAR_DIR, LABEL_DIR)

    print(f"Loaded {len(test_pairs)} test tiles (should be 90)")

    print("Loading model...")
    model = tf.keras.models.load_model(
        MODEL_PATH,
        custom_objects={
            "combined_loss": combined_loss,
            "masked_weighted_bce": masked_weighted_bce,
            "masked_dice_loss": masked_dice_loss,
            "masked_iou": masked_iou,
        },
    )

    # --- Overall test IoU, as a sanity check ---
    ious = []
    all_sars, all_labels, all_preds = [], [], []
    for sar_path, label_path in test_pairs:
        sar, label = load_sample(sar_path, label_path)
        pred = model.predict(sar[np.newaxis, ...], verbose=0)[0, :, :, 0]

        label_tensor = tf.constant(label[np.newaxis, ..., np.newaxis])
        pred_tensor = tf.constant(pred[np.newaxis, ..., np.newaxis])
        iou = masked_iou(label_tensor, pred_tensor).numpy()
        ious.append(iou)

        all_sars.append(sar)
        all_labels.append(label)
        all_preds.append(pred)

    print(f"\nMean test IoU across {len(ious)} tiles: {np.mean(ious):.4f}")
    print("(This should be close to the 0.50 seen during training's final "
          "evaluation — if it's very different, something changed between "
          "runs, e.g. a different data split or model file.)")

    # --- Save side-by-side visualizations for a handful of examples ---
    print(f"\nSaving {NUM_EXAMPLES_TO_VISUALIZE} example visualizations to "
          f"{OUTPUT_DIR}/ ...")

    # Prioritize showing examples that actually contain some water, so
    # you're not just looking at empty tiles.
    water_fraction = [
        np.mean(lbl == 1) for lbl in all_labels
    ]
    example_indices = np.argsort(water_fraction)[::-1][:NUM_EXAMPLES_TO_VISUALIZE]

    for rank, idx in enumerate(example_indices):
        sar, label, pred = all_sars[idx], all_labels[idx], all_preds[idx]

        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        axes[0].imshow(sar[:, :, 0], cmap="gray")  # VV channel
        axes[0].set_title("SAR input (VV)")
        axes[0].axis("off")

        # Ground truth: 0=no water, 1=water, -1=missing -> mask it grey
        gt_display = np.ma.masked_where(label == -1, label)
        axes[1].imshow(gt_display, cmap="Blues", vmin=0, vmax=1)
        axes[1].set_title("Ground truth")
        axes[1].axis("off")

        axes[2].imshow(pred, cmap="Blues", vmin=0, vmax=1)
        axes[2].set_title(f"Prediction (IoU: {ious[idx]:.3f})")
        axes[2].axis("off")

        plt.tight_layout()
        out_path = os.path.join(OUTPUT_DIR, f"example_{rank+1}.png")
        plt.savefig(out_path, dpi=120)
        plt.close(fig)
        print(f"  saved {out_path}")

    print("\nDone. Open the PNGs in test_predictions/ to inspect results.")


if __name__ == "__main__":
    main()
