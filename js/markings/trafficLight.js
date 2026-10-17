class TrafficLight extends Marking {
    constructor(center, directionVector, width, height) {
        super(center, directionVector, width, height);

        this.border = this.poly.segments[2];
        this.type = "trafficLight";

        // 4-Phase Traffic Light Cycle:
        // Phase 2: RED (4.0s = 240 frames) -> switches from red to yellow in 4 sec
        // Phase 3: YELLOW before Green (2.0s = 120 frames) -> switches from yellow to green in 2 sec
        // Phase 0: GREEN (4.0s = 240 frames) -> Go
        // Phase 1: YELLOW before Red (2.0s = 120 frames) -> Prepare to Stop
        this.phases = ["green", "yellow_to_red", "red", "yellow_to_green"];

        // Start directly at RED (Phase 2) so user immediately observes:
        // RED (4s) -> YELLOW (2s) -> GREEN (Go)
        this.phaseIndex = 2;
        this.#setPhase(this.phaseIndex);
        this.timer = 0;
    }

    #setPhase(index) {
        this.phaseIndex = ((index % 4) + 4) % 4;
        this.timer = 0;

        switch (this.phaseIndex) {
            case 0:
                // GREEN: 4 sec (240 frames) -> Go
                this.state = "green";
                this.currentDuration = 240;
                break;
            case 1:
                // YELLOW before RED: Exactly 2 sec (120 frames) -> Prepare to Stop
                this.state = "yellow";
                this.currentDuration = 120;
                break;
            case 2:
                // RED: Exactly 4 sec (240 frames) -> switches from red to yellow in 4 sec
                this.state = "red";
                this.currentDuration = 240;
                break;
            case 3:
                // YELLOW before GREEN: Exactly 2 sec (120 frames) -> switches from yellow to green in 2 sec
                this.state = "yellow";
                this.currentDuration = 120;
                break;
        }
    }

    getRemainingSeconds() {
        return Math.max(1, Math.ceil((this.currentDuration - this.timer) / 60));
    }

    update() {
        this.timer++;
        if (this.timer >= this.currentDuration) {
            this.#setPhase(this.phaseIndex + 1);
        }
    }

    draw(ctx) {
        this.update();

        // 1. Draw thick white Stop Line across the traffic lane
        this.border.draw(ctx, { width: 4, color: "white" });

        // 2. Draw Traffic Light Pole & Signal Box on the road curb
        ctx.save();
        ctx.translate(this.center.x, this.center.y);
        ctx.rotate(angle(this.directionVector) - Math.PI / 2);

        // Position signal box on the right curb / sidewalk
        const postOffset = this.width * 0.65;
        const boxW = 16;
        const boxH = 44;
        const boxX = postOffset;
        const boxY = -boxH / 2;

        // Mounting pole / arm from curb
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.width * 0.48, 0);
        ctx.lineTo(boxX, 0);
        ctx.stroke();

        // Dark housing with metallic bezel
        ctx.fillStyle = "#090d16";
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 4);
        ctx.fill();
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const lightRadius = 4.5;
        const lightX = boxX + boxW / 2;
        const redY = boxY + 8;
        const yellowY = boxY + 22;
        const greenY = boxY + 36;

        // --- RED LIGHT (Top) ---
        ctx.beginPath();
        ctx.arc(lightX, redY, lightRadius, 0, Math.PI * 2);
        if (this.state === "red") {
            ctx.fillStyle = "#ef4444";
            ctx.shadowColor = "#ef4444";
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "#451a1a";
            ctx.fill();
        }

        // --- YELLOW LIGHT (Middle) ---
        ctx.beginPath();
        ctx.arc(lightX, yellowY, lightRadius, 0, Math.PI * 2);
        if (this.state === "yellow") {
            ctx.fillStyle = "#f59e0b";
            ctx.shadowColor = "#f59e0b";
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "#453214";
            ctx.fill();
        }

        // --- GREEN LIGHT (Bottom) ---
        ctx.beginPath();
        ctx.arc(lightX, greenY, lightRadius, 0, Math.PI * 2);
        if (this.state === "green") {
            ctx.fillStyle = "#22c55e";
            ctx.shadowColor = "#22c55e";
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "#143820";
            ctx.fill();
        }

        // --- DIGITAL TIMER DISPLAY (Above Housing) ---
        const sec = this.getRemainingSeconds();
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = this.state === "red" ? "#ef4444" : (this.state === "yellow" ? "#f59e0b" : "#22c55e");
        ctx.fillText(sec + "s", lightX, boxY - 3);

        ctx.restore();
    }
}

// Seamless extension of Marking.load without touching core environment file
if (typeof Marking !== "undefined") {
    const originalMarkingLoad = Marking.load;
    Marking.load = function (info) {
        if (info.type === "trafficLight") {
            const point = new Point(info.center.x, info.center.y);
            const dir = new Point(info.directionVector.x, info.directionVector.y);
            return new TrafficLight(point, dir, info.width, info.height);
        }
        return originalMarkingLoad(info);
    };
}
