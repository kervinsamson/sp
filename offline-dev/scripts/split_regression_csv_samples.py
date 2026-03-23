import csv
import os
import sys


BASE_DIR = os.path.dirname(os.path.dirname(__file__))


def _wave_columns(fieldnames: list[str]) -> list[str]:
    wave_columns = [name for name in fieldnames if name.lower().startswith("wave_")]
    if not wave_columns:
        raise ValueError("No Wave_* columns found in source CSV.")

    def wave_index(column_name: str) -> int:
        try:
            return int(column_name.split("_", 1)[1])
        except (IndexError, ValueError) as exc:
            raise ValueError(f"Invalid wave column format: {column_name}") from exc

    return sorted(wave_columns, key=wave_index)


def main() -> None:
    input_path = sys.argv[1] if len(sys.argv) > 1 else "corn_mp5_regression_data.csv"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "corn_mp5_samples"
    wavenumber_start = float(sys.argv[3]) if len(sys.argv) > 3 else 1100.0
    wavenumber_step = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0

    if not os.path.isabs(input_path):
        input_path = os.path.join(BASE_DIR, input_path)
    if not os.path.isabs(output_dir):
        output_dir = os.path.join(BASE_DIR, output_dir)

    os.makedirs(output_dir, exist_ok=True)

    created_count = 0
    with open(input_path, "r", newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames is None:
            raise ValueError("CSV has no header row.")

        wave_columns = _wave_columns(reader.fieldnames)

        for row_index, row in enumerate(reader, start=1):
            output_file = os.path.join(output_dir, f"sample_{row_index:04d}.csv")
            with open(output_file, "w", newline="", encoding="utf-8") as out_file:
                writer = csv.writer(out_file)
                writer.writerow(["wavenumber", "intensity"])

                for wave_index, wave_column in enumerate(wave_columns):
                    raw_value = row.get(wave_column, "")
                    try:
                        intensity = float(raw_value)
                    except (TypeError, ValueError):
                        continue

                    wavenumber = wavenumber_start + (wave_index * wavenumber_step)
                    if wavenumber.is_integer():
                        wavenumber_value: int | float = int(wavenumber)
                    else:
                        wavenumber_value = wavenumber

                    writer.writerow([wavenumber_value, intensity])

            created_count += 1

    print(
        f"Created {created_count} sample CSV files in: {output_dir} "
        f"(format: wavenumber,intensity)"
    )


if __name__ == "__main__":
    main()