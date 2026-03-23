import csv
import os
import sys

import matplotlib.pyplot as plt


BASE_DIR = os.path.dirname(os.path.dirname(__file__))


def main() -> None:
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "corn_mp5_regression_data.csv"
    if not os.path.isabs(csv_path):
        csv_path = os.path.join(BASE_DIR, csv_path)

    with open(csv_path, "r", newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames is None:
            raise ValueError("CSV has no header row.")

        wave_columns = [name for name in reader.fieldnames if name.startswith("Wave_")]
        if not wave_columns:
            raise ValueError("No Wave_ columns found in CSV.")

        x_axis = [int(name.split("_")[1]) for name in wave_columns]

        plt.figure(figsize=(12, 6))
        sample_count = 0
        for row in reader:
            y_values = [float(row[column]) for column in wave_columns]
            plt.plot(x_axis, y_values, alpha=0.45)
            sample_count += 1

    plt.title(f"corn_mp5_regression_data.csv ({sample_count} samples)")
    plt.xlabel("Wave Index")
    plt.ylabel("Intensity")
    plt.grid(True, alpha=0.2)
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()