class Car {
    static porscheImg = (() => {
        const img = new Image();
        img.src = "js/car.png";
        return img;
    })();

    static gwagonImg = (() => {
        const img = new Image();
        img.src = "js/gwagonCar.png";
        return img;
    })();

    constructor(
        x,
        y,
        width = 36,
        height = 60,
        controlType = "AI",
        maxSpeed = 2.8,
        angle = 0,
        world = null,
        carType = null
    ) {
        this.startX = x;
        this.startY = y;
        this.startAngle = angle;
        this.world = world;

        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.speed = 0;
        this.acceleration = 0.16;
        this.maxSpeed = maxSpeed;
        this.friction = 0.05;
        this.angle = angle;
        this.damaged = false;

        this.controlType = controlType;
        this.controls = new Controls(controlType);

        this.sensor = new Sensor(this, 2, 80, Math.PI * 0.28);
        this.polygon = this.#createPolygon();

        // Randomly select vehicle model: Porsche 911 or Mercedes G-Wagon
        this.carType = carType || (Math.random() < 0.5 ? "porsche" : "gwagon");
        this.img = this.carType === "porsche" ? Car.porscheImg : Car.gwagonImg;

        // Telemetry & State
        this.markingStatus = "Ready";
        this.stopTimer = 0;
        this.waitingAtLight = false;
        this.isQueued = false;
        this.currentStopMarking = null;
        this.clearedMarkings = new Set();
        this.cautionSpeed = null;
        this.aliveFrames = 0;
        this.totalDistance = 0;
        this.currentSegment = null;

        // Anti-gridlock & Deadlock Breaker
        this.stuckTimer = 0;
        this.isExecutingUTurn = false;
    }

    reset(x = this.startX, y = this.startY, angle = this.startAngle) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 0;
        this.damaged = false;
        this.stopTimer = 0;
        this.waitingAtLight = false;
        this.isQueued = false;
        this.currentStopMarking = null;
        this.clearedMarkings.clear();
        this.cautionSpeed = null;
        this.markingStatus = "Ready";
        this.aliveFrames = 0;
        this.totalDistance = 0;
        this.currentSegment = null;
        this.stuckTimer = 0;
        this.isExecutingUTurn = false;
        this.controls.reset();
        this.polygon = this.#createPolygon();
        if (this.sensor) {
            this.sensor.clear();
        }
    }

    update(world, otherCars = []) {
        this.world = world;

        // Safeguard against empty world
        if (!world || !world.graph || !world.graph.segments || world.graph.segments.length === 0) {
            this.speed = 0;
            this.controls.reset();
            this.markingStatus = "Parked (No Road)";
            if (this.sensor) this.sensor.clear();
            return;
        }

        this.aliveFrames++;

        // 1. Markings Compliance: Stop signs, Traffic Lights (Red/Yellow/Green), Crossings
        this.#handleMarkingRules(world);

        // 2. Safe Multi-Car Spacing & Traffic Light Queuing (Never touches cars ahead!)
        this.#handleCarSpacing(otherCars, world);

        // 3. Autonomous Road Centerline Following (with dead-end turnaround & sharp turn dynamics)
        if (this.controlType === "AI") {
            this.#followRoad(world);
        }

        // 4. Update Kinematics
        this.#move();

        // 5. Update Bounding Box
        this.polygon = this.#createPolygon();

        // 6. Active Collision Assessment & Self-Recovery (Never stays crashed)
        this.#assessDamage(world);

        // 7. Deadlock Detector & Breaker
        this.#checkDeadlock(world);

        // 8. Update Sensors
        if (this.sensor) {
            this.sensor.update(
                world.roadBorders,
                world.buildings,
                world.markings,
                otherCars
            );
        }
    }

    #checkDeadlock(world) {
        // If not legitimately stopped at stop sign, red light, or queued behind cars, but speed is zero for > 40 frames:
        if (this.stopTimer <= 0 && !this.waitingAtLight && !this.isQueued && Math.abs(this.speed) < 0.05) {
            this.stuckTimer++;
            if (this.stuckTimer > 40) {
                this.angle += 0.08;
                this.speed = 0.8;
                this.controls.forward = true;
                this.markingStatus = "Clearing Deadlock";
                if (this.stuckTimer > 80) {
                    this.stuckTimer = 0;
                }
            }
        } else {
            this.stuckTimer = 0;
        }
    }

    #handleCarSpacing(otherCars, world) {
        if (!otherCars || otherCars.length <= 1) {
            this.isQueued = false;
            return;
        }

        const carPos = new Point(this.x, this.y);
        const carForward = new Point(-Math.sin(this.angle), -Math.cos(this.angle));
        let shouldQueue = false;

        for (const other of otherCars) {
            if (other === this) continue;
            const otherPos = new Point(other.x, other.y);
            const dist = distance(carPos, otherPos);

            // Car ahead in forward path
            if (dist < 120) {
                const toOther = subtract(otherPos, carPos);
                const dotProd = dot(normalize(toOther), carForward);
                const otherForward = new Point(-Math.sin(other.angle), -Math.cos(other.angle));
                const carsFacingEachOther = dot(carForward, otherForward) < -0.5;

                if (dotProd > 0.45) {
                    // DEAD-END CONVOY SOLVER:
                    if (carsFacingEachOther || other.markingStatus.includes("Dead End") || other.markingStatus.includes("U-Turn")) {
                        this.angle += 0.085;
                        this.speed = Math.max(0.6, this.speed);
                        this.controls.forward = true;
                        this.controls.reverse = false;
                        this.markingStatus = "Clearing Path for Convoy";
                        return;
                    }

                    // TRAFFIC LIGHT / STOP SIGN QUEUE SPACING:
                    // Stop cleanly with safe gap (center-to-center ~ 78px for 60px cars = 18px bumper air gap)
                    // They stop WITHOUT touching each other!
                    const isOtherStopping = other.speed < 0.4 || other.waitingAtLight || other.isQueued || other.stopTimer > 0;

                    if (isOtherStopping) {
                        if (dist < 78) {
                            shouldQueue = true;
                            this.isQueued = true;
                            this.speed = 0;
                            this.controls.forward = false;
                            this.controls.reverse = false;
                            this.markingStatus = "Queued with Space";

                            // Physical safety buffer: enforce clean 16px bumper gap so cars NEVER touch
                            if (dist < 76) {
                                const pushDir = normalize(subtract(carPos, otherPos));
                                this.x = otherPos.x + pushDir.x * 76;
                                this.y = otherPos.y + pushDir.y * 76;
                            }
                            return;
                        } else if (dist < 105) {
                            this.cautionSpeed = Math.min(
                                this.cautionSpeed !== null ? this.cautionSpeed : this.maxSpeed,
                                Math.max(0.35, (dist - 74) * 0.04)
                            );
                        }
                    } else {
                        // Following moving traffic with safe buffer
                        if (dist < 72) {
                            this.speed = Math.min(this.speed, other.speed * 0.85);
                        } else if (dist < 95) {
                            this.cautionSpeed = Math.min(this.cautionSpeed !== null ? this.cautionSpeed : this.maxSpeed, other.speed);
                        }
                    }
                }
            }
        }

        if (!shouldQueue) {
            this.isQueued = false;
        }
    }

    #handleMarkingRules(world) {
        if (!this.sensor || !world.markings) return;

        this.cautionSpeed = null;
        let activeAlert = null;

        // If currently stopped at a STOP sign, count down yield timer
        if (this.stopTimer > 0) {
            this.speed = Math.max(0, this.speed - this.acceleration * 1.5);
            this.stopTimer--;
            this.markingStatus = `Yielding at STOP (${Math.ceil(this.stopTimer / 30)}s)`;

            if (this.stopTimer <= 0) {
                if (this.currentStopMarking) {
                    this.clearedMarkings.add(this.currentStopMarking);
                }
                this.currentStopMarking = null;
                this.markingStatus = "Cleared STOP";
            }
            return;
        }

        // Default waitingAtLight state
        let foundRedLight = false;

        // Inspect detected road markings
        for (const detection of this.sensor.markingReadings) {
            const marking = detection.marking;
            const type = detection.type;

            if (detection.distance > 130 && this.clearedMarkings.has(marking)) {
                this.clearedMarkings.delete(marking);
            }

            // 1. TRAFFIC LIGHT (Red stop, Yellow prepare/get ready, Green go)
            if (type === "trafficLight") {
                const tl = marking;
                const carForward = new Point(-Math.sin(this.angle), -Math.cos(this.angle));
                const dirDot = dot(carForward, tl.directionVector);

                // Only obey light if driving in the forward direction of this signal
                if (dirDot > 0.2 && detection.distance < 95) {
                    const sec = tl.getRemainingSeconds ? tl.getRemainingSeconds() : "";

                    if (tl.state === "red") {
                        activeAlert = `Traffic Light: RED (Stop ${sec}s)`;
                        if (detection.distance <= 45) {
                            foundRedLight = true;
                            this.waitingAtLight = true;
                            this.speed = Math.max(0, this.speed - this.acceleration * 2);
                            if (this.speed < 0.1) this.speed = 0;
                            this.controls.forward = false;
                            this.controls.reverse = false;
                        } else {
                            this.cautionSpeed = Math.min(
                                this.cautionSpeed !== null ? this.cautionSpeed : this.maxSpeed,
                                Math.max(0.4, (detection.distance - 42) * 0.035)
                            );
                        }
                        break;
                    } else if (tl.state === "yellow") {
                        if (tl.phaseIndex === 3) {
                            // Phase 3: Yellow switching to Green in 2 sec ("Get Ready")
                            activeAlert = `Traffic Light: YELLOW (Get Ready ${sec}s)`;
                            if (detection.distance <= 45 && (this.waitingAtLight || this.speed < 0.2)) {
                                foundRedLight = true;
                                this.waitingAtLight = true;
                                this.speed = 0;
                                this.controls.forward = false;
                                this.controls.reverse = false;
                            } else {
                                this.cautionSpeed = 0.8;
                            }
                        } else {
                            // Phase 1: Yellow switching to Red in 2 sec ("Prepare to Stop")
                            activeAlert = `Traffic Light: YELLOW (Prepare to Stop ${sec}s)`;
                            if (detection.distance <= 45) {
                                foundRedLight = true;
                                this.waitingAtLight = true;
                                this.speed = Math.max(0, this.speed - this.acceleration * 2);
                                if (this.speed < 0.1) this.speed = 0;
                                this.controls.forward = false;
                                this.controls.reverse = false;
                            } else {
                                this.cautionSpeed = Math.min(
                                    this.cautionSpeed !== null ? this.cautionSpeed : this.maxSpeed,
                                    1.0
                                );
                            }
                        }
                        break;
                    } else if (tl.state === "green") {
                        activeAlert = `Traffic Light: GREEN (Go ${sec}s)`;
                        this.waitingAtLight = false;
                    }
                }
            }

            // 2. STOP SIGN
            else if (type === "stop" && !this.clearedMarkings.has(marking)) {
                if (detection.distance < 55) {
                    activeAlert = "Approaching STOP";
                    if (this.speed > 0.2) {
                        this.controls.forward = false;
                        this.controls.reverse = true;
                    } else {
                        this.speed = 0;
                        this.stopTimer = 50;
                        this.currentStopMarking = marking;
                    }
                    break;
                }
            }

            // 3. PEDESTRIAN CROSSING
            else if (type === "crossing") {
                if (detection.distance < 75) {
                    activeAlert = "Crossing: Slowing down";
                    this.cautionSpeed = Math.min(
                        this.cautionSpeed !== null ? this.cautionSpeed : this.maxSpeed,
                        1.2
                    );
                }
            }
        }

        if (!foundRedLight) {
            this.waitingAtLight = false;
        }

        if (!this.stopTimer && activeAlert) {
            this.markingStatus = activeAlert;
        } else if (!this.stopTimer && !activeAlert) {
            if (this.isQueued) {
                this.markingStatus = "Queued with Space";
            } else {
                this.markingStatus = this.speed > 0.1 ? "Cruising" : "Stopped";
            }
        }
    }

    #followRoad(world) {
        const carPos = new Point(this.x, this.y);
        const carForward = new Point(-Math.sin(this.angle), -Math.cos(this.angle));

        const segments = world.graph.segments;
        if (!segments || segments.length === 0) {
            this.controls.reset();
            return;
        }

        // Find nearest segment in road network
        let bestSeg = this.currentSegment;
        if (!bestSeg || !segments.includes(bestSeg) || bestSeg.distanceToPoint(carPos) > 75) {
            let minDist = Infinity;
            for (const seg of segments) {
                const dist = seg.distanceToPoint(carPos);
                if (dist < minDist) {
                    minDist = dist;
                    bestSeg = seg;
                }
            }
        }

        if (!bestSeg) return;
        this.currentSegment = bestSeg;

        // Current forward direction along segment
        const segDir = bestSeg.directionVector();
        const goingForward = dot(carForward, segDir) >= 0;
        const forwardDir = goingForward ? segDir : scale(segDir, -1);
        const targetEnd = goingForward ? bestSeg.p2 : bestSeg.p1;

        // Check if targetEnd is a DEAD END
        const otherConnected = segments.filter(
            (s) => s !== bestSeg && (s.p1.equals(targetEnd) || s.p2.equals(targetEnd))
        );
        const isDeadEnd = otherConnected.length === 0;

        // Projection of car on segment
        const proj = bestSeg.projectPoint(carPos);
        const currentOffset = Math.max(0, Math.min(1, proj.offset));
        const segLen = Math.max(1, bestSeg.length());
        const distToEnd = (goingForward ? (1.0 - currentOffset) : currentOffset) * segLen;

        // In-place dead-end turnaround
        if (isDeadEnd && distToEnd < 55) {
            const reverseDir = scale(forwardDir, -1);
            const reverseAngle = Math.atan2(-reverseDir.x, -reverseDir.y);

            let turnDiff = reverseAngle - this.angle;
            while (turnDiff > Math.PI) turnDiff -= Math.PI * 2;
            while (turnDiff < -Math.PI) turnDiff += Math.PI * 2;

            if (Math.abs(turnDiff) > 0.08) {
                this.angle += Math.sign(turnDiff) * 0.085;
                this.speed = 0;
                this.controls.forward = false;
                this.controls.reverse = false;
                this.markingStatus = "U-Turn at Dead End";
                return;
            } else {
                this.angle = reverseAngle;
                this.speed = 0.8;
                this.controls.forward = true;
                this.controls.reverse = false;
                this.markingStatus = "Exiting Dead End";
                return;
            }
        }

        // Adaptive look-ahead
        let lookAheadDist = 60;
        if (this.speed < 1.5) {
            lookAheadDist = 38;
        }

        const deltaOffset = lookAheadDist / segLen;
        let targetPoint;

        if (goingForward) {
            if (currentOffset + deltaOffset <= 1.0) {
                targetPoint = lerp2D(bestSeg.p1, bestSeg.p2, currentOffset + deltaOffset);
            } else {
                const nextSeg = this.#findNextConnectedSegment(world.graph, targetEnd, bestSeg, forwardDir);
                if (nextSeg) {
                    if (currentOffset > 0.8) {
                        this.currentSegment = nextSeg;
                    }
                    const remainingDist = (currentOffset + deltaOffset - 1.0) * segLen;
                    const nextGoingForward = nextSeg.p1.equals(targetEnd);
                    const fraction = Math.min(1, remainingDist / Math.max(1, nextSeg.length()));
                    targetPoint = nextGoingForward
                        ? lerp2D(nextSeg.p1, nextSeg.p2, fraction)
                        : lerp2D(nextSeg.p2, nextSeg.p1, fraction);
                } else {
                    targetPoint = bestSeg.p2;
                }
            }
        } else {
            if (currentOffset - deltaOffset >= 0.0) {
                targetPoint = lerp2D(bestSeg.p1, bestSeg.p2, currentOffset - deltaOffset);
            } else {
                const nextSeg = this.#findNextConnectedSegment(world.graph, targetEnd, bestSeg, forwardDir);
                if (nextSeg) {
                    if (currentOffset < 0.2) {
                        this.currentSegment = nextSeg;
                    }
                    const remainingDist = (deltaOffset - currentOffset) * segLen;
                    const nextGoingForward = nextSeg.p1.equals(targetEnd);
                    const fraction = Math.min(1, remainingDist / Math.max(1, nextSeg.length()));
                    targetPoint = nextGoingForward
                        ? lerp2D(nextSeg.p1, nextSeg.p2, fraction)
                        : lerp2D(nextSeg.p2, nextSeg.p1, fraction);
                } else {
                    targetPoint = bestSeg.p1;
                }
            }
        }

        // Steer toward look-ahead target
        const toTarget = subtract(targetPoint, carPos);
        const targetAngle = Math.atan2(-toTarget.x, -toTarget.y);

        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Reactive border repulsion from sensor rays
        if (this.sensor && this.sensor.readings && this.sensor.readings.length >= 2) {
            const left = this.sensor.readings[0];
            const right = this.sensor.readings[1];
            if (left && left.offset < 0.42) {
                angleDiff -= 0.22 * (1 - left.offset / 0.42);
            }
            if (right && right.offset < 0.42) {
                angleDiff += 0.22 * (1 - right.offset / 0.42);
            }
        }

        // Steering commands
        this.controls.left = angleDiff > 0.03;
        this.controls.right = angleDiff < -0.03;

        // Dynamic speed control
        const absDiff = Math.abs(angleDiff);
        let cruiseSpeed = this.maxSpeed;
        if (absDiff > 0.6) {
            cruiseSpeed = 0.95;
        } else if (absDiff > 0.35) {
            cruiseSpeed = 1.5;
        } else if (absDiff > 0.18) {
            cruiseSpeed = 2.1;
        }

        if (this.cautionSpeed !== null) {
            cruiseSpeed = Math.min(cruiseSpeed, this.cautionSpeed);
        }

        if (this.stopTimer > 0 || this.waitingAtLight || this.isQueued) {
            this.controls.forward = false;
            this.controls.reverse = false;
            return;
        }

        if (this.speed < cruiseSpeed) {
            this.controls.forward = true;
            this.controls.reverse = false;
        } else if (this.speed > cruiseSpeed + 0.25) {
            this.controls.forward = false;
            this.controls.reverse = true;
        } else {
            this.controls.forward = false;
            this.controls.reverse = false;
        }
    }

    #findNextConnectedSegment(graph, junctionPoint, currentSeg, currentDir) {
        const connected = graph.segments.filter(
            (s) => s !== currentSeg && (s.p1.equals(junctionPoint) || s.p2.equals(junctionPoint))
        );

        if (connected.length === 0) return null;
        if (connected.length === 1) return connected[0];

        const forwardOptions = [];
        for (const seg of connected) {
            const segOutDir = seg.p1.equals(junctionPoint)
                ? seg.directionVector()
                : scale(seg.directionVector(), -1);

            const d = dot(currentDir, segOutDir);
            if (d > -0.65) {
                forwardOptions.push(seg);
            }
        }

        const choices = forwardOptions.length > 0 ? forwardOptions : connected;
        return choices[Math.floor(Math.random() * choices.length)];
    }

    #move() {
        const effectiveMax = this.cautionSpeed !== null
            ? Math.min(this.maxSpeed, this.cautionSpeed)
            : this.maxSpeed;

        if (this.controls.forward) {
            this.speed += this.acceleration;
        }
        if (this.controls.reverse) {
            this.speed -= this.acceleration;
        }

        if (this.speed > effectiveMax) {
            this.speed = effectiveMax;
        }
        if (this.speed < -effectiveMax / 2) {
            this.speed = -effectiveMax / 2;
        }

        if (this.speed > 0) {
            this.speed -= this.friction;
        }
        if (this.speed < 0) {
            this.speed += this.friction;
        }
        if (Math.abs(this.speed) < this.friction) {
            this.speed = 0;
        }

        if (this.speed !== 0) {
            const flip = this.speed > 0 ? 1 : -1;
            const steerRate = Math.abs(this.speed) < 1.4 ? 0.065 : 0.042;
            if (this.controls.left) {
                this.angle += steerRate * flip;
            }
            if (this.controls.right) {
                this.angle -= steerRate * flip;
            }
        }

        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;

        this.totalDistance += Math.abs(this.speed);
    }

    #createPolygon() {
        const points = [];
        const rad = Math.hypot(this.width, this.height) / 2;
        const alpha = Math.atan2(this.width, this.height);

        points.push(
            new Point(
                this.x - Math.sin(this.angle - alpha) * rad,
                this.y - Math.cos(this.angle - alpha) * rad
            )
        );
        points.push(
            new Point(
                this.x - Math.sin(this.angle + alpha) * rad,
                this.y - Math.cos(this.angle + alpha) * rad
            )
        );
        points.push(
            new Point(
                this.x - Math.sin(Math.PI + this.angle - alpha) * rad,
                this.y - Math.cos(Math.PI + this.angle - alpha) * rad
            )
        );
        points.push(
            new Point(
                this.x - Math.sin(Math.PI + this.angle + alpha) * rad,
                this.y - Math.cos(Math.PI + this.angle + alpha) * rad
            )
        );

        return new Polygon(points);
    }

    #assessDamage(world) {
        if (this.aliveFrames < 25) return false;

        let collided = false;
        if (world.roadBorders) {
            for (let i = 0; i < this.polygon.segments.length; i++) {
                const carSeg = this.polygon.segments[i];
                for (let j = 0; j < world.roadBorders.length; j++) {
                    const borderSeg = world.roadBorders[j];
                    if (getIntersection(carSeg.p1, carSeg.p2, borderSeg.p1, borderSeg.p2)) {
                        collided = true;
                        break;
                    }
                }
                if (collided) break;
            }
        }

        // Auto-Recovery: if car contacts a border, immediately nudge it back to road center!
        if (collided && this.currentSegment) {
            const proj = this.currentSegment.projectPoint(new Point(this.x, this.y));
            this.x = lerp(this.x, proj.point.x, 0.45);
            this.y = lerp(this.y, proj.point.y, 0.45);
            this.speed = Math.max(0.6, this.speed * 0.5);
            this.markingStatus = "Recovering";
            return false;
        }

        return false;
    }

    draw(ctx, { drawSensors = true, alpha = 1.0, isBest = false } = {}) {
        if (!this.world || !this.world.graph || !this.world.graph.segments || this.world.graph.segments.length === 0) {
            return;
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        if (isBest) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.height * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
            ctx.stroke();
        }

        ctx.translate(this.x, this.y);
        ctx.rotate(-this.angle);

        try {
            if (this.carType === "gwagon") {
                // Crop the G-Wagon tight bounding box so it is drawn wide, bold and centered
                ctx.drawImage(
                    this.img,
                    499, 32, 538, 960,
                    -this.width / 2,
                    -this.height / 2,
                    this.width,
                    this.height
                );
            } else {
                // Porsche 911 sprite cropped to its non-transparent bounding box
                ctx.drawImage(
                    this.img,
                    91, 58, 790, 1515,
                    -this.width / 2,
                    -this.height / 2,
                    this.width,
                    this.height
                );
            }
        } catch (e) {
            ctx.fillStyle = "#38bdf8";
            ctx.beginPath();
            ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 6);
            ctx.fill();
        }

        ctx.restore();

        if (drawSensors && this.sensor && !this.damaged) {
            this.sensor.draw(ctx);
        }
    }
}
