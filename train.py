"""Train the fish image classifier used by the upload prediction flow.

Usage:
    python train.py
    python train.py --epochs 10 --batch-size 32

The dataset must use this layout:
    dataset/FishImgDataset/{train,val,test}/<fish-class>/*.{jpg,jpeg,png}
"""

from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.utils.class_weight import compute_class_weight

SEED = 42
IMAGE_SIZE = (224, 224)
AUTOTUNE = tf.data.AUTOTUNE


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the fish image classifier.")
    parser.add_argument("--dataset", type=Path, default=Path("dataset/FishImgDataset"))
    parser.add_argument("--output", type=Path, default=Path("server/models"))
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--fine-tune", type=int, default=2, help="Extra epochs after unfreezing the final backbone layers.")
    return parser.parse_args()


def load_split(path: Path, batch_size: int, shuffle: bool) -> tuple[tf.data.Dataset, list[str]]:
    dataset = tf.keras.utils.image_dataset_from_directory(
        path,
        labels="inferred",
        label_mode="int",
        image_size=IMAGE_SIZE,
        batch_size=batch_size,
        shuffle=shuffle,
        seed=SEED,
    )
    class_names = list(dataset.class_names)
    dataset = dataset.prefetch(AUTOTUNE)
    return dataset, class_names


def dataset_labels(dataset: tf.data.Dataset) -> np.ndarray:
    labels = []
    for _, batch_labels in dataset.unbatch().batch(1024):
        labels.extend(batch_labels.numpy().tolist())
    return np.asarray(labels, dtype=np.int64)


def build_model(class_count: int) -> tuple[tf.keras.Model, tf.keras.Model]:
    augmentation = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.08),
            tf.keras.layers.RandomZoom(0.12),
            tf.keras.layers.RandomContrast(0.1),
        ],
        name="fish_augmentation",
    )
    backbone = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(*IMAGE_SIZE, 3),
    )
    backbone.trainable = False
    inputs = tf.keras.Input(shape=(*IMAGE_SIZE, 3), name="fish_image")
    x = augmentation(inputs)
    x = tf.keras.applications.efficientnet.preprocess_input(x)
    x = backbone(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(class_count, activation="softmax", name="fish_class")(x)
    model = tf.keras.Model(inputs, outputs, name="fish_classifier")
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model, backbone


def main() -> None:
    args = parse_args()
    random.seed(SEED)
    np.random.seed(SEED)
    tf.random.set_seed(SEED)
    tf.keras.utils.set_random_seed(SEED)

    train_path = args.dataset / "train"
    val_path = args.dataset / "val"
    test_path = args.dataset / "test"
    for split_path in (train_path, val_path, test_path):
        if not split_path.is_dir():
            raise FileNotFoundError(f"Dataset split not found: {split_path}")

    print(f"TensorFlow: {tf.__version__}")
    print(f"Devices: {tf.config.list_physical_devices()}")
    print(f"Dataset: {args.dataset.resolve()}")
    train_data, class_names = load_split(train_path, args.batch_size, shuffle=True)
    val_data, val_classes = load_split(val_path, args.batch_size, shuffle=False)
    test_data, test_classes = load_split(test_path, args.batch_size, shuffle=False)
    if class_names != val_classes or class_names != test_classes:
        raise ValueError("train, val, and test class folders do not match")

    train_labels = dataset_labels(train_data)
    weights = compute_class_weight("balanced", classes=np.arange(len(class_names)), y=train_labels)
    class_weights = {index: float(weight) for index, weight in enumerate(weights)}
    print(f"Classes ({len(class_names)}): {', '.join(class_names)}")
    print(f"Images: train={len(train_labels)}")

    output_dir = args.output
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "fish_classifier.keras"
    labels_path = output_dir / "fish_labels.json"
    metrics_path = output_dir / "fish_metrics.json"
    with labels_path.open("w", encoding="utf-8") as file:
        json.dump({"classes": class_names, "image_size": list(IMAGE_SIZE)}, file, indent=2)

    model, backbone = build_model(len(class_names))
    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(model_path, monitor="val_accuracy", save_best_only=True),
        tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=2, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.3, patience=1, min_lr=1e-6),
    ]
    print("Training classifier head...")
    model.fit(train_data, validation_data=val_data, epochs=args.epochs, class_weight=class_weights, callbacks=callbacks)

    if args.fine_tune > 0:
        backbone.trainable = True
        for layer in backbone.layers[:-30]:
            layer.trainable = False
        model.compile(optimizer=tf.keras.optimizers.Adam(1e-5), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
        print(f"Fine-tuning final backbone layers for up to {args.fine_tune} epoch(s)...")
        model.fit(train_data, validation_data=val_data, epochs=args.fine_tune, class_weight=class_weights, callbacks=callbacks)

    model = tf.keras.models.load_model(model_path)
    test_loss, test_accuracy = model.evaluate(test_data, verbose=1)
    metrics = {"test_loss": float(test_loss), "test_accuracy": float(test_accuracy), "classes": class_names}
    with metrics_path.open("w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)
    print(f"Test accuracy: {test_accuracy:.4f}")
    print(f"Saved model: {model_path.resolve()}")
    print(f"Saved labels: {labels_path.resolve()}")
    print(f"Saved metrics: {metrics_path.resolve()}")


if __name__ == "__main__":
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "1")
    main()
