class Graph {
    constructor(points = [], segments = []) {
        this.points = points;
        this.segments = segments;
    }

    static load(info) {
        const points = [];
        const segments = [];
        for (const p of info.points) {
            points.push(new Point(p.x, p.y));
        }
        for (const s of info.segments) {
            segments.push(new Segment(
             points.find((p) => p.equals(s.p1)),
             points.find((p) => p.equals(s.p2))
            
            )
            
            );
        }
        return new Graph(points, segments);   
    }

    hash() {
    return JSON.stringify(this);
    }

    addPoint(point) {
        this.points.push(point);
    }

    containsPoint(point) {
        return this.points.find(p => p.equals(point));
    }

    tryAddPoint(point) {
        if (!this.containsPoint(point)) {
            this.addPoint(point);
            return true;
        }
        return false;
    }
    removePoint(point) {
        const segs = this.getSegmentsWithPoint(point);
        for (const seg of segs) {
            this.removeSegment(seg);
        }
        this.points.splice(this.points.indexOf(point), 1);

    }
    
    addSegment(segment) { 
        this.segments.push(segment);
    }

    containsSegment(segment) {
        return this.segments.find(s => s.equals(segment));
    }

   tryAddSegment(seg) {
        if (!this.containsSegment(seg) && !seg.p1.equals(seg.p2)) {
            this.addSegment(seg);
            return true;
        }

        return false;
    }
    removeSegment(seg) {
        this.segments.splice(this.segments.indexOf(seg), 1);

    }
    getSegmentsWithPoint(point) {
        const segs = [];
        for (const seg of this.segments) {
        if (seg.includesPoint(point)) {
            segs.push(seg);
        }
    }
        return segs;
    }

    dispose() {
        this.points.length = 0;
        this.segments.length = 0;
    }

    draw(ctx) {
        for (const seg of this.segments) {
            seg.draw(ctx);
        }

        for (const point of this.points) {
            point.draw(ctx);
        }
    }
}