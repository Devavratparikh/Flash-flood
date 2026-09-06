"""
Sen1Floods11 SAR Flood Segmentation — TensorFlow/Keras starter script
=======================================================================

Trains a U-Net on the 446 hand-labeled Sen1Floods11 chips to segment
water/no-water from Sentinel-1 VV+VH SAR imagery.

EXPECTED DATA LAYOUT
---------------------
Sen1Floods11's hand-labeled release ("v1.1") ships as GeoTIFFs, typically
organized like:

    Sen1Floods11/
        v1.1/
            data/
                flood_events/
                    HandLabeled/
                        S1Hand/          <- 2-band VV/VH SAR images (*.tif)
                        LabelHand/       <- 1-band labels (*.tif), values in {-1, 0, 1}

Filenames pair up by a shared prefix, e.g.:
    Bolivia_103757_S1Hand.tif   <->   Bolivia_103757_LabelHand.tif

Adjust SAR_DIR / LABEL_DIR below to match wherever you download it
(Radiant MLHub, the cloudtostreet GitHub repo, or a GEE export).

LABEL CONVENTION
-----------------
    0  = no water
    1  = water
   -1  = missing / masked (cloud-affected in the original Sentinel-2
        label-generation step) — EXCLUDED from the loss and metrics.

Install deps first:
    pip install tensorflow rasterio numpy --break-system-packages
"""

import os
import glob
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
import rasterio

# ---------------------------------------------------------------------------
# Config — EDIT THESE PATHS
# ---------------------------------------------------------------------------
SAR_DIR = "HandLabeled/S1Hand"
LABEL_DIR = "HandLabeled/LabelHand"

IMG_SIZE = 512          # chips are natively 512x512
BATCH_SIZE = 8
EPOCHS = 40
LEARNING_RATE = 1e-4
VAL_SPLIT = 89 / 446    # matches the paper's official val proportion
TEST_SPLIT = 90 / 446   # matches the paper's official test proportion
SEED = 42

AUTOTUNE = tf.data.AUTOTUNE


# ---------------------------------------------------------------------------
# 1. File pairing
# ---------------------------------------------------------------------------
def get_pairs(sar_dir, label_dir):
    """Match each SAR image to its label by shared filename prefix."""
    sar_files = sorted(glob.glob(os.path.join(sar_dir, "*.tif")))
    pairs = []
    for sar_path in sar_files:
        base = os.path.basename(sar_path).replace("_S1Hand.tif", "")
        label_path = os.path.join(label_dir, f"{base}_LabelHand.tif")
        if os.path.exists(label_path):
            pairs.append((sar_path, label_path))
        else:
            print(f"[warn] no label found for {sar_path}, skipping")
    if not pairs:
        raise FileNotFoundError(
            "No SAR/label pairs found — check SAR_DIR / LABEL_DIR and the "
            "filename suffix convention (_S1Hand.tif / _LabelHand.tif)."
        )
    return pairs


def read_tif(path):
    with rasterio.open(path) as src:
        arr = src.read()  # shape: (bands, H, W)
    return arr


# ---------------------------------------------------------------------------
# 2. Preprocessing
# ---------------------------------------------------------------------------
def normalize_vv_vh(sar_arr):
    """
    Per-channel min-max normalization for VV/VH SAR bands.
    SAR backscatter is in dB and varies a lot scene-to-scene, so we clip to
    a sane dB range first, then rescale to [0, 1]. Adjust the clip range if
    your data looks off after inspecting a histogram.
    """
    # Sen1Floods11 tiles can contain NaN or +/-inf no-data pixels at scene
    # edges. A single NaN poisons min()/max() for the whole tile (and from
    # there, the whole batch), which is what was producing `loss: nan`.
    # Replace them with a safe in-range value BEFORE clipping/normalizing.
    sar_arr = np.nan_to_num(sar_arr, nan=-50.0, posinf=1.0, neginf=-50.0)
    sar_arr = np.clip(sar_arr, -50.0, 1.0)
    out = np.zeros_like(sar_arr, dtype=np.float32)
    for c in range(sar_arr.shape[0]):
        band = sar_arr[c]
        mn, mx = band.min(), band.max()
        out[c] = (band - mn) / (mx - mn + 1e-6)
    return out


def load_sample(sar_path, label_path):
    sar = read_tif(sar_path.numpy().decode("utf-8"))       # (2, H, W)
    label = read_tif(label_path.numpy().decode("utf-8"))    # (1, H, W)

    sar = normalize_vv_vh(sar)
    sar = np.transpose(sar, (1, 2, 0))                       # (H, W, 2)

    label = label[0].astype(np.float32)                      # (H, W)
    label = np.expand_dims(label, axis=-1)                   # (H, W, 1)

    return sar, label


def tf_load_sample(sar_path, label_path):
    sar, label = tf.py_function(
        func=load_sample,
        inp=[sar_path, label_path],
        Tout=[tf.float32, tf.float32],
    )
    sar.set_shape([IMG_SIZE, IMG_SIZE, 2])
    label.set_shape([IMG_SIZE, IMG_SIZE, 1])
    return sar, label


def make_dataset(pairs, training=False):
    sar_paths = [p[0] for p in pairs]
    label_paths = [p[1] for p in pairs]
    ds = tf.data.Dataset.from_tensor_slices((sar_paths, label_paths))
    ds = ds.map(tf_load_sample, num_parallel_calls=AUTOTUNE)
    if training:
        ds = ds.shuffle(buffer_size=len(pairs), seed=SEED)
        ds = ds.map(augment, num_parallel_calls=AUTOTUNE)
    ds = ds.batch(BATCH_SIZE)
    ds = ds.prefetch(AUTOTUNE)
    return ds


def augment(sar, label):
    """Simple flip/rotate augmentation — SAR speckle noise means aggressive
    photometric augmentation (color jitter etc.) doesn't make sense here."""
    if tf.random.uniform(()) > 0.5:
        sar = tf.image.flip_left_right(sar)
        label = tf.image.flip_left_right(label)
    if tf.random.uniform(()) > 0.5:
        sar = tf.image.flip_up_down(sar)
        label = tf.image.flip_up_down(label)
    k = tf.random.uniform((), minval=0, maxval=4, dtype=tf.int32)
    sar = tf.image.rot90(sar, k)
    label = tf.image.rot90(label, k)
    return sar, label


# ---------------------------------------------------------------------------
# 3. U-Net model
# ---------------------------------------------------------------------------
def conv_block(x, filters):
    x = layers.Conv2D(filters, 3, padding="same", activation="relu")(x)
    x = layers.Conv2D(filters, 3, padding="same", activation="relu")(x)
    return x


def build_unet(input_shape=(IMG_SIZE, IMG_SIZE, 2)):
    inputs = layers.Input(shape=input_shape)

    # Encoder
    c1 = conv_block(inputs, 32)
    p1 = layers.MaxPooling2D()(c1)

    c2 = conv_block(p1, 64)
    p2 = layers.MaxPooling2D()(c2)

    c3 = conv_block(p2, 128)
    p3 = layers.MaxPooling2D()(c3)

    c4 = conv_block(p3, 256)
    p4 = layers.MaxPooling2D()(c4)

    # Bottleneck
    bn = conv_block(p4, 512)

    # Decoder
    u4 = layers.Conv2DTranspose(256, 2, strides=2, padding="same")(bn)
    u4 = layers.Concatenate()([u4, c4])
    d4 = conv_block(u4, 256)

    u3 = layers.Conv2DTranspose(128, 2, strides=2, padding="same")(d4)
    u3 = layers.Concatenate()([u3, c3])
    d3 = conv_block(u3, 128)

    u2 = layers.Conv2DTranspose(64, 2, strides=2, padding="same")(d3)
    u2 = layers.Concatenate()([u2, c2])
    d2 = conv_block(u2, 64)

    u1 = layers.Conv2DTranspose(32, 2, strides=2, padding="same")(d2)
    u1 = layers.Concatenate()([u1, c1])
    d1 = conv_block(u1, 32)

    outputs = layers.Conv2D(1, 1, activation="sigmoid")(d1)

    return models.Model(inputs, outputs, name="unet_sar_flood")


# ---------------------------------------------------------------------------
# 4. Masked loss + metrics (ignore label == -1)
# ---------------------------------------------------------------------------
def masked_bce(y_true, y_pred):
    mask = tf.cast(tf.not_equal(y_true, -1.0), tf.float32)
    y_true_safe = tf.clip_by_value(y_true, 0.0, 1.0)  # avoid -1 hitting BCE
    bce = tf.keras.losses.binary_crossentropy(y_true_safe, y_pred)
    bce = tf.expand_dims(bce, axis=-1)
    masked = bce * mask
    return tf.reduce_sum(masked) / (tf.reduce_sum(mask) + 1e-6)


# WATER_CLASS_WEIGHT: how much more a water pixel's error counts vs a
# non-water pixel's error. Water is a small minority class in most tiles,
# so plain BCE lets the model minimize loss by predicting "no water"
# everywhere (loss goes down, IoU stays exactly 0 forever). Weighting the
# rarer class up forces the model to actually pay attention to it.
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
    # Dice measures overlap directly rather than per-pixel probability, so
    # it doesn't have the same "predict all-zero" escape hatch that BCE
    # does under class imbalance.
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
# 5. Train
# ---------------------------------------------------------------------------
def main():
    pairs = get_pairs(SAR_DIR, LABEL_DIR)
    rng = np.random.default_rng(SEED)
    rng.shuffle(pairs)

    n = len(pairs)
    n_test = int(round(n * TEST_SPLIT))
    n_val = int(round(n * VAL_SPLIT))
    test_pairs = pairs[:n_test]
    val_pairs = pairs[n_test:n_test + n_val]
    train_pairs = pairs[n_test + n_val:]

    print(f"Train: {len(train_pairs)}  Val: {len(val_pairs)}  Test: {len(test_pairs)}")

    train_ds = make_dataset(train_pairs, training=True)
    val_ds = make_dataset(val_pairs, training=False)
    test_ds = make_dataset(test_pairs, training=False)

    model = build_unet()
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss=combined_loss,
        metrics=[masked_iou],
    )
    model.summary()

    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            "best_sar_unet.keras", monitor="val_masked_iou",
            mode="max", save_best_only=True,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_masked_iou", mode="max",
            patience=8, restore_best_weights=True,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_masked_iou", mode="max",
            factor=0.5, patience=4,
        ),
    ]

    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=EPOCHS,
        callbacks=callbacks,
    )

    print("\nTest set evaluation:")
    model.evaluate(test_ds)


if __name__ == "__main__":
    main()