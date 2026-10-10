"""Predict the fish class for one image using the trained model.

Usage:
    python predict.py --image path/to/fish.jpg
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict a fish species from an image.")
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--model", type=Path, default=Path("server/models/fish_classifier.keras"))
    parser.add_argument("--labels", type=Path, default=Path("server/models/fish_labels.json"))
    args = parser.parse_args()

    if not args.image.is_file():
        raise FileNotFoundError(f"Image not found: {args.image}")
    model = tf.keras.models.load_model(args.model)
    labels = json.loads(args.labels.read_text(encoding="utf-8"))
    image_size = tuple(labels.get("image_size", [224, 224]))
    image = tf.keras.utils.load_img(args.image, target_size=image_size)
    array = tf.keras.utils.img_to_array(image)[None, ...]
    probabilities = model.predict(array, verbose=0)[0]
    best_indices = np.argsort(probabilities)[-3:][::-1]
    predictions = [{"fish": labels["classes"][int(index)], "confidence": round(float(probabilities[index]), 4)} for index in best_indices]
    print(json.dumps({"image": str(args.image), "prediction": predictions[0], "alternatives": predictions[1:]}))


if __name__ == "__main__":
    main()
