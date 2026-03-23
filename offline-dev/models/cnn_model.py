import tensorflow as tf
from tensorflow.keras.layers import Conv1D, Dense, Flatten, MaxPooling1D
from tensorflow.keras.models import Sequential


def build_cnn(input_length):
    model = Sequential(
        [
            Conv1D(filters=32, kernel_size=3, activation="relu", input_shape=(input_length, 1)),
            MaxPooling1D(pool_size=2),
            Conv1D(filters=64, kernel_size=3, activation="relu"),
            MaxPooling1D(pool_size=2),
            Flatten(),
            Dense(64, activation="relu"),
            Dense(32, activation="relu"),
            Dense(1, activation="sigmoid"),
        ]
    )

    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def train_and_predict_cnn(
    x_train,
    y_train,
    x_test,
    random_state=42,
    epochs=30,
    batch_size=16,
    validation_split=0.1,
):
    tf.random.set_seed(random_state)

    x_train_cnn = x_train.reshape(x_train.shape[0], x_train.shape[1], 1)
    x_test_cnn = x_test.reshape(x_test.shape[0], x_test.shape[1], 1)

    model = build_cnn(x_train.shape[1])
    model.fit(
        x_train_cnn,
        y_train,
        epochs=epochs,
        batch_size=batch_size,
        verbose=0,
        validation_split=validation_split,
    )

    y_pred_prob = model.predict(x_test_cnn)
    y_pred = (y_pred_prob > 0.5).astype(int).flatten()

    return model, y_pred
