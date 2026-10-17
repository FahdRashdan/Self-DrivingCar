class Simulation {
    constructor(world) {
        this.world = world;
        this.isRunning = false;
        this.isManual = false;
        this.cameraFollow = false;

        this.cars = [];
        this.activeCarIndex = 0;

        this.syncCarsWithWorld();
    }

    get car() {
        return this.cars[this.activeCarIndex] || this.cars[0] || null;
    }

    syncCarsWithWorld() {
        if (!this.world || !this.world.graph || !this.world.graph.segments || this.world.graph.segments.length === 0) {
            this.clear();
            return;
        }

        // Check if user placed any Start markings
        const startMarkings = (this.world.markings || []).filter(
            (m) => m.type === "start" || (m instanceof Start)
        );

        if (startMarkings.length > 0) {
            for (const m of startMarkings) {
                const angle = Math.atan2(-m.directionVector.x, -m.directionVector.y);
                // Check if a car already exists at or near this start point
                const exists = this.cars.some(
                    (c) => distance(new Point(c.x, c.y), m.center) < 30
                );
                if (!exists) {
                    this.cars.push(
                        new Car(m.center.x, m.center.y, 36, 60, "AI", 2.8, angle, this.world)
                    );
                }
            }
        }

        // If no cars exist at all, spawn 1 car on a clean road segment
        if (this.cars.length === 0) {
            this.addCar();
        }
    }

    addCar(x, y, angle) {
        if (!this.world || !this.world.graph || !this.world.graph.segments || this.world.graph.segments.length === 0) {
            return null;
        }

        // Spawn at a random position along a random road segment
        if (x === undefined || y === undefined) {
            const segments = this.world.graph.segments;
            const randomSeg = segments[Math.floor(Math.random() * segments.length)];
            
            // Random fraction along segment (between 25% and 75% for smooth clearance)
            const randomT = 0.25 + Math.random() * 0.5;
            const spawnPoint = lerp2D(randomSeg.p1, randomSeg.p2, randomT);
            
            const dir = randomSeg.directionVector();
            x = spawnPoint.x;
            y = spawnPoint.y;
            angle = Math.atan2(-dir.x, -dir.y);
        }

        const newCar = new Car(x, y, 36, 60, "AI", 2.8, angle, this.world);

        // If cars are already moving, the new car starts driving immediately!
        if (this.isRunning) {
            newCar.sensor.update(
                this.world.roadBorders,
                this.world.buildings,
                this.world.markings,
                this.cars
            );
        }

        this.cars.push(newCar);
        return newCar;
    }

    removeAllCars() {
        this.clear();
    }

    clear() {
        this.isRunning = false;
        for (const car of this.cars) {
            car.speed = 0;
            car.controls.reset();
            if (car.sensor) car.sensor.clear();
        }
        this.cars = [];
    }

    reset() {
        this.isRunning = false;
        if (!this.world || !this.world.graph || !this.world.graph.segments || this.world.graph.segments.length === 0) {
            this.clear();
            return;
        }

        if (this.cars.length === 0) {
            this.syncCarsWithWorld();
        } else {
            for (const car of this.cars) {
                car.reset();
            }
        }
    }

    start() {
        if (!this.world || !this.world.graph || !this.world.graph.segments || this.world.graph.segments.length === 0) return;
        
        // Remove static start markings from the road when cars start moving so no phantom cars remain!
        if (this.world.markings) {
            for (let i = this.world.markings.length - 1; i >= 0; i--) {
                const m = this.world.markings[i];
                if (m.type === "start" || (typeof Start !== "undefined" && m instanceof Start)) {
                    this.world.markings.splice(i, 1);
                }
            }
        }

        if (this.cars.length === 0) {
            this.syncCarsWithWorld();
        }
        this.isRunning = true;
    }

    pause() {
        this.isRunning = false;
    }

    toggle() {
        if (!this.isRunning) {
            this.start();
        } else {
            this.pause();
        }
        return this.isRunning;
    }

    toggleManual() {
        this.isManual = !this.isManual;
        if (this.car) {
            this.car.controlType = this.isManual ? "KEYS" : "AI";
            this.car.controls = new Controls(this.car.controlType);
        }
        return this.isManual;
    }

    update() {
        if (!this.isRunning) return;
        if (!this.world || !this.world.graph || !this.world.graph.segments || this.world.graph.segments.length === 0) {
            this.clear();
            return;
        }

        // Clean up any start markings from the road surface while cars are moving
        if (this.world.markings) {
            for (let i = this.world.markings.length - 1; i >= 0; i--) {
                const m = this.world.markings[i];
                if (m.type === "start" || (typeof Start !== "undefined" && m instanceof Start)) {
                    this.world.markings.splice(i, 1);
                }
            }
        }

        // Update all cars with mutual awareness
        for (let i = 0; i < this.cars.length; i++) {
            this.cars[i].update(this.world, this.cars);
        }
    }

    draw(ctx) {
        if (!this.world || !this.world.graph || !this.world.graph.segments || this.world.graph.segments.length === 0) {
            return;
        }

        for (let i = 0; i < this.cars.length; i++) {
            const isLeading = i === 0;
            this.cars[i].draw(ctx, { drawSensors: true, alpha: 1.0, isBest: isLeading });
        }
    }

    getStats() {
        const lead = this.car;
        return {
            carCount: this.cars.length,
            speed: lead ? (lead.speed * 10).toFixed(1) : "0.0",
            distance: lead ? Math.floor(lead.totalDistance) : 0,
            status: lead ? lead.markingStatus : (this.cars.length === 0 ? "No Cars" : "Ready"),
            isManual: this.isManual,
            isRunning: this.isRunning
        };
    }
}
