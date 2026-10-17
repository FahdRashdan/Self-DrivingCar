class Sensor {
    constructor(car, rayCount = 2, rayLength = 80, raySpread = Math.PI * 0.28) {
        this.car = car;
        this.rayCount = rayCount;
        this.rayLength = rayLength;
        this.raySpread = raySpread;

        this.rays = [];
        this.readings = [];
        this.markingReadings = [];

        this.#castRays();
    }

    clear() {
        this.rays = [];
        this.readings = [];
        this.markingReadings = [];
    }

    update(roadBorders = [], buildings = [], markings = [], otherCars = []) {
        if (!this.car || !this.car.world || !this.car.world.graph || this.car.world.graph.segments.length === 0) {
            this.clear();
            return;
        }

        this.#castRays();
        this.readings = [];

        // Obstacles: road borders + building footprints + other cars
        const obstacleSegments = [...roadBorders];
        if (buildings) {
            for (const b of buildings) {
                if (b.base && b.base.segments) {
                    obstacleSegments.push(...b.base.segments);
                }
            }
        }

        if (otherCars) {
            for (const c of otherCars) {
                if (c !== this.car && c.polygon && c.polygon.segments) {
                    obstacleSegments.push(...c.polygon.segments);
                }
            }
        }

        for (let i = 0; i < this.rays.length; i++) {
            this.readings.push(
                this.#getReading(this.rays[i], obstacleSegments)
            );
        }

        // Detect markings (Stop signs, Crossings, etc.)
        this.#detectMarkings(markings);
    }

    #getReading(ray, segments) {
        const touches = [];

        for (let i = 0; i < segments.length; i++) {
            const touch = getIntersection(
                ray.p1,
                ray.p2,
                segments[i].p1,
                segments[i].p2
            );
            if (touch) {
                touches.push(touch);
            }
        }

        if (touches.length === 0) {
            return null;
        }

        const offsets = touches.map((e) => e.offset);
        const minOffset = Math.min(...offsets);
        return touches.find((e) => e.offset === minOffset);
    }

    #castRays() {
        this.rays = [];
        for (let i = 0; i < this.rayCount; i++) {
            const rayAngle =
                lerp(
                    this.raySpread / 2,
                    -this.raySpread / 2,
                    this.rayCount === 1 ? 0.5 : i / (this.rayCount - 1)
                ) + this.car.angle;

            const start = new Point(this.car.x, this.car.y);
            const end = new Point(
                this.car.x - Math.sin(rayAngle) * this.rayLength,
                this.car.y - Math.cos(rayAngle) * this.rayLength
            );

            this.rays.push(new Segment(start, end));
        }
    }

    #detectMarkings(markings) {
        this.markingReadings = [];
        if (!markings || markings.length === 0) return;

        const carPos = new Point(this.car.x, this.car.y);
        const carForward = new Point(-Math.sin(this.car.angle), -Math.cos(this.car.angle));

        for (const marking of markings) {
            if (!marking.center) continue;
            const dist = distance(carPos, marking.center);

            if (dist < 120) {
                const toMarking = subtract(marking.center, carPos);
                const dotProduct = dot(normalize(toMarking), carForward);

                // Marking is ahead of car
                if (dotProduct > 0.4) {
                    let inPath = dist < 50;
                    if (marking.poly && marking.poly.segments) {
                        for (const ray of this.rays) {
                            for (const seg of marking.poly.segments) {
                                if (getIntersection(ray.p1, ray.p2, seg.p1, seg.p2)) {
                                    inPath = true;
                                    break;
                                }
                            }
                            if (inPath) break;
                        }
                    }

                    this.markingReadings.push({
                        marking,
                        type: marking.type,
                        distance: dist,
                        inPath,
                        offset: dist / 120,
                        center: marking.center
                    });
                }
            }
        }

        this.markingReadings.sort((a, b) => a.distance - b.distance);
    }

    draw(ctx) {
        // Do not draw if rays are empty or world is cleared
        if (!this.rays || this.rays.length === 0) return;
        if (!this.car.world || !this.car.world.graph || this.car.world.graph.segments.length === 0) return;

        for (let i = 0; i < this.rayCount; i++) {
            if (!this.rays[i]) continue;

            let end = this.rays[i].p2;
            let hasContact = false;

            if (this.readings && this.readings[i]) {
                end = new Point(this.readings[i].x, this.readings[i].y);
                hasContact = true;
            }

            // Sleek Electric Blue Ray line
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
            ctx.moveTo(this.rays[i].p1.x, this.rays[i].p1.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            // Crisp White Contact Dot (instead of red!)
            if (hasContact) {
                // Outer subtle blue glow
                ctx.beginPath();
                ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
                ctx.fill();

                // Crisp White Dot
                ctx.beginPath();
                ctx.arc(end.x, end.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
            }
        }
    }
}
