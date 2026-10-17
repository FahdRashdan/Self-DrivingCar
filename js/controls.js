class Controls {
    constructor(type = "KEYS") {
        this.forward = false;
        this.left = false;
        this.right = false;
        this.reverse = false;
        this.type = type;

        switch (type) {
            case "KEYS":
                this.#addKeyboardListeners();
                break;
            case "DUMMY":
                this.forward = true;
                break;
            case "AI":
                // Controls will be driven by the Neural Network
                break;
        }
    }

    #addKeyboardListeners() {
        document.addEventListener("keydown", (event) => {
            if (this.type !== "KEYS") return;
            switch (event.key) {
                case "ArrowLeft":
                case "a":
                case "A":
                    this.left = true;
                    break;
                case "ArrowRight":
                case "d":
                case "D":
                    this.right = true;
                    break;
                case "ArrowUp":
                case "w":
                case "W":
                    this.forward = true;
                    break;
                case "ArrowDown":
                case "s":
                case "S":
                    this.reverse = true;
                    break;
            }
        });

        document.addEventListener("keyup", (event) => {
            if (this.type !== "KEYS") return;
            switch (event.key) {
                case "ArrowLeft":
                case "a":
                case "A":
                    this.left = false;
                    break;
                case "ArrowRight":
                case "d":
                case "D":
                    this.right = false;
                    break;
                case "ArrowUp":
                case "w":
                case "W":
                    this.forward = false;
                    break;
                case "ArrowDown":
                case "s":
                case "S":
                    this.reverse = false;
                    break;
            }
        });
    }

    reset() {
        this.forward = false;
        this.left = false;
        this.right = false;
        this.reverse = false;
    }
}
