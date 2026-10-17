class Building {
  constructor(poly, heightCoef = 0.075, style = {}) {
    this.base = poly;
    this.heightCoef = heightCoef;
    this.roofHeightCoef = heightCoef * 1.5;

    // Palette
    this.wallColor = style.wallColor || "#ded7cb";   // Warm limestone / render
    this.roofColor = style.roofColor || "#d05c4f";   // Light terracotta red
    this.trimColor = style.trimColor || "#ffffff";   // Crisp white frame
    this.glassColor = style.glassColor || "#93c5fd"; // Soft sky-reflective blue
    this.doorColor = style.doorColor || "#4a3328";   // Dark wood door
    this.strokeColor = style.strokeColor || "rgba(25, 20, 20, 0.4)";
    this.sunDir = { x: -0.707, y: -0.707 };
  }

static load(info) {
    return new Building(
        Polygon.load(info.base),
        info.heightCoef
    );
}

  #shadeColor(hex, lum) {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    const num = parseInt(c, 16);
    const safeLum = Math.max(0.2, Math.min(1.8, isNaN(lum) ? 1 : lum));
    const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * safeLum)));
    const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * safeLum)));
    const b = Math.min(255, Math.max(0, Math.round((num & 255) * safeLum)));
    return `rgb(${r}, ${g}, ${b})`;
  }

  #getLighting(p1, p2, isCCW = true) {
    const edge = subtract(p2, p1);
    const len = Math.hypot(edge.x, edge.y);
    if (!len || isNaN(len)) return 0.85;

    // Adjust normal calculation to match polygon winding direction
    const sign = isCCW ? 1 : -1;
    const normal = { x: (edge.y / len) * sign, y: (-edge.x / len) * sign };
    const dot = normal.x * this.sunDir.x + normal.y * this.sunDir.y;
    return lerp(0.65, 1.15, (dot + 1) / 2);
  }

  #isCounterClockwise(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      sum += (p2.x - p1.x) * (p2.y + p1.y);
    }
    return sum < 0; // True if counter-clockwise in screen coordinates
  }

  draw(ctx, viewPoint) {
    if (!this.base || !this.base.points || this.base.points.length < 3) return;

    // Filter out duplicate or collapsed consecutive points
    const pts = [];
    for (let i = 0; i < this.base.points.length; i++) {
      const p = this.base.points[i];
      const prev = pts[pts.length - 1];
      if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.001) {
        pts.push(p);
      }
    }
    if (pts.length < 3) return;

    const len = pts.length;
    const isCCW = this.#isCounterClockwise(pts);

    // 1. Safe centroid calculation
    let cX = 0, cY = 0;
    for (const p of pts) {
      cX += p.x;
      cY += p.y;
    }
    const center = new Point(cX / len, cY / len);

    // 2. Projected Wall Tops & Apex
    const rawTopPoints = pts.map((p) =>
      add(p, scale(subtract(p, viewPoint), this.heightCoef))
    );

    const eavePoints = rawTopPoints.map((p) => lerp2D(center, p, 1.07));

    const roofApex = add(
      center,
      scale(subtract(center, viewPoint), this.roofHeightCoef)
    );

    // 3. Ground Cast Shadow (safely offset away from the sun)
    const shadowOffset = scale(this.sunDir, -8);
    const shadowPoints = pts.map((p) => add(p, shadowOffset));
    new Polygon(shadowPoints).draw(ctx, {
      fill: "rgba(10, 20, 15, 0.18)",
      stroke: "transparent",
      lineWidth: 0
    });

    // 4. Construct Walls & Details
    const sides = [];
    for (let i = 0; i < len; i++) {
      const nextI = (i + 1) % len;
      const b1 = pts[i];
      const b2 = pts[nextI];
      const t1 = rawTopPoints[i];
      const t2 = rawTopPoints[nextI];

      const wallLength = Math.hypot(b2.x - b1.x, b2.y - b1.y);
      if (wallLength < 1) continue; // Skip degenerately small edges

      const poly = new Polygon([b1, b2, t2, t1]);
      const lum = this.#getLighting(b1, b2, isCCW);
      const details = [];

      // Windows and door only on adequately wide & lit faces
      if (lum > 0.72 && wallLength > 18) {
        if (i === 0) {
          const dB1 = lerp2D(b1, b2, 0.42);
          const dB2 = lerp2D(b1, b2, 0.58);
          const dT1 = lerp2D(t1, t2, 0.42);
          const dT2 = lerp2D(t1, t2, 0.58);

          details.push({
            poly: new Polygon([
              dB1,
              dB2,
              lerp2D(dB2, dT2, 0.6),
              lerp2D(dB1, dT1, 0.6)
            ]),
            fill: this.doorColor,
            stroke: "#261a14"
          });
        }

        const addWindow = (u1, u2) => {
          const wb1 = lerp2D(b1, b2, u1);
          const wb2 = lerp2D(b1, b2, u2);
          const wt1 = lerp2D(t1, t2, u1);
          const wt2 = lerp2D(t1, t2, u2);

          const winP1 = lerp2D(wb1, wt1, 0.35);
          const winP2 = lerp2D(wb2, wt2, 0.35);
          const winP3 = lerp2D(wb2, wt2, 0.75);
          const winP4 = lerp2D(wb1, wt1, 0.75);

          details.push({
            poly: new Polygon([winP1, winP2, winP3, winP4]),
            fill: this.glassColor,
            stroke: this.trimColor,
            lineWidth: 1.2
          });

          const midH1 = lerp2D(winP1, winP4, 0.5);
          const midH2 = lerp2D(winP2, winP3, 0.5);
          const midV1 = lerp2D(winP1, winP2, 0.5);
          const midV2 = lerp2D(winP4, winP3, 0.5);

          details.push({ segment: new Segment(midH1, midH2), stroke: this.trimColor });
          details.push({ segment: new Segment(midV1, midV2), stroke: this.trimColor });
        };

        if (i !== 0) addWindow(0.18, 0.36);
        addWindow(0.64, 0.82);
      }

      sides.push({
        poly,
        t1,
        t2,
        lum,
        dist: poly.distanceToPoint(viewPoint),
        details
      });
    }

    // 5. Construct Roof Facets
    const roofFacets = [];
    for (let i = 0; i < len; i++) {
      const nextI = (i + 1) % len;
      const facet = new Polygon([
        eavePoints[i],
        eavePoints[nextI],
        roofApex
      ]);
      const lum = this.#getLighting(eavePoints[i], eavePoints[nextI], isCCW);
      roofFacets.push({
        poly: facet,
        lum: lum * 1.06,
        dist: facet.distanceToPoint(viewPoint)
      });
    }

    // 6. Sort faces back-to-front
    sides.sort((a, b) => b.dist - a.dist);
    roofFacets.sort((a, b) => b.dist - a.dist);

    // 7. Base footprint
    this.base.draw(ctx, {
      fill: "rgba(0, 0, 0, 0.12)",
      stroke: "transparent",
      lineWidth: 0
    });

    // 8. Render Walls + Facade Elements
    for (const side of sides) {
      side.poly.draw(ctx, {
        fill: this.#shadeColor(this.wallColor, side.lum),
        stroke: this.strokeColor,
        lineWidth: 1
      });

      new Segment(side.t1, side.t2).draw(ctx, {
        color: "rgba(20, 15, 10, 0.35)",
        width: 1.5
      });

      for (const d of side.details) {
        if (d.poly) {
          d.poly.draw(ctx, {
            fill: d.fill,
            stroke: d.stroke,
            lineWidth: d.lineWidth || 1
          });
        } else if (d.segment) {
          d.segment.draw(ctx, { color: d.stroke, width: 1 });
        }
      }
    }

    // 9. Render Roof Facets
    for (const roof of roofFacets) {
      roof.poly.draw(ctx, {
        fill: this.#shadeColor(this.roofColor, roof.lum),
        stroke: this.strokeColor,
        lineWidth: 1
      });
    }
  }
}