class Building {
  constructor(poly, heightCoef = 0.2, style = {}) {
    this.base = poly;
    this.heightCoef = heightCoef; // Shorter residential wall height
    this.roofHeightCoef = heightCoef * 1.32; // Modest, realistic roof pitch
    
    // Palette
    this.wallColor = style.wallColor || "#ded6c8"; // Warm limestone / stucco
    this.roofColor = style.roofColor || "#8f2d22"; // Terracotta shingle
    this.trimColor = style.trimColor || "#2b343b"; // Window/door trims
    this.glassColor = style.glassColor || "#93c5fd"; // Soft sky-reflective blue
    this.strokeColor = style.strokeColor || "rgba(25, 20, 20, 0.4)";
  }

  #shadeColor(hex, lum) {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    const num = parseInt(c, 16);
    const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * lum)));
    const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * lum)));
    const b = Math.min(255, Math.max(0, Math.round((num & 255) * lum)));
    return `rgb(${r}, ${g}, ${b})`;
  }

  #getLighting(p1, p2, sunDir = { x: -0.707, y: -0.707 }) {
    const edge = subtract(p2, p1);
    const len = Math.hypot(edge.x, edge.y) || 1;
    const normal = { x: edge.y / len, y: -edge.x / len };
    const dot = normal.x * sunDir.x + normal.y * sunDir.y;
    return lerp(0.6, 1.15, (dot + 1) / 2);
  }

  draw(ctx, viewPoint) {
    // 1. Perspective projection for wall tops
    const rawTopPoints = this.base.points.map((p) =>
      add(p, scale(subtract(p, viewPoint), this.heightCoef))
    );

    // 2. Base centroid
    let cX = 0, cY = 0;
    for (const p of this.base.points) {
      cX += p.x;
      cY += p.y;
    }
    const center = new Point(
      cX / this.base.points.length,
      cY / this.base.points.length
    );

    // 3. Eaves overhang (flares roofline slightly past the exterior walls)
    const eavePoints = rawTopPoints.map((p) => lerp2D(center, p, 1.06));

    // 4. Roof peak / apex
    const roofApex = add(
      center,
      scale(subtract(center, viewPoint), this.roofHeightCoef)
    );

    // 5. Construct wall segments & facade details
    const sides = [];
    const len = this.base.points.length;
    for (let i = 0; i < len; i++) {
      const nextI = (i + 1) % len;
      const b1 = this.base.points[i];
      const b2 = this.base.points[nextI];
      const t1 = rawTopPoints[i];
      const t2 = rawTopPoints[nextI];

      const poly = new Polygon([b1, b2, t2, t1]);
      const lum = this.#getLighting(b1, b2);

      // Only add windows/doors to well-lit or camera-visible walls
      const details = [];
      const wallDist = poly.distanceToPoint(viewPoint);
      if (lum > 0.72) {
        // Doorway on primary wall
        if (i === 0) {
          const dB1 = lerp2D(b1, b2, 0.4);
          const dB2 = lerp2D(b1, b2, 0.6);
          const dT1 = lerp2D(t1, t2, 0.4);
          const dT2 = lerp2D(t1, t2, 0.6);
          details.push({
            poly: new Polygon([
              dB1,
              dB2,
              lerp2D(dB2, dT2, 0.55),
              lerp2D(dB1, dT1, 0.55)
            ]),
            fill: "#3f2d24"
          });
        }

        // Window frames
        const w1B1 = lerp2D(b1, b2, 0.18);
        const w1B2 = lerp2D(b1, b2, 0.35);
        const w1T1 = lerp2D(t1, t2, 0.18);
        const w1T2 = lerp2D(t1, t2, 0.35);

        const w2B1 = lerp2D(b1, b2, 0.65);
        const w2B2 = lerp2D(b1, b2, 0.82);
        const w2T1 = lerp2D(t1, t2, 0.65);
        const w2T2 = lerp2D(t1, t2, 0.82);

        const makeWindow = (pb1, pb2, pt1, pt2) => new Polygon([
          lerp2D(pb1, pt1, 0.35),
          lerp2D(pb2, pt2, 0.35),
          lerp2D(pb2, pt2, 0.72),
          lerp2D(pb1, pt1, 0.72)
        ]);

        if (i !== 0) details.push({ poly: makeWindow(w1B1, w1B2, w1T1, w1T2), fill: this.glassColor });
        details.push({ poly: makeWindow(w2B1, w2B2, w2T1, w2T2), fill: this.glassColor });
      }

      sides.push({ poly, lum, dist: wallDist, details });
    }

    // 6. Construct roof facets
    const roofFacets = [];
    for (let i = 0; i < len; i++) {
      const nextI = (i + 1) % len;
      const facet = new Polygon([
        eavePoints[i],
        eavePoints[nextI],
        roofApex
      ]);
      const lum = this.#getLighting(eavePoints[i], eavePoints[nextI]);
      roofFacets.push({
        poly: facet,
        lum: lum * 1.04,
        dist: facet.distanceToPoint(viewPoint)
      });
    }

    // Sort back-to-front
    sides.sort((a, b) => b.dist - a.dist);
    roofFacets.sort((a, b) => b.dist - a.dist);

    // 7. Ambient ground shadow footprint
    this.base.draw(ctx, {
      fill: "rgba(10, 15, 20, 0.22)",
      stroke: "transparent",
      lineWidth: 0
    });

    // 8. Render wall polygons + architectural details
    for (const side of sides) {
      side.poly.draw(ctx, {
        fill: this.#shadeColor(this.wallColor, side.lum),
        stroke: this.strokeColor,
        lineWidth: 1
      });

      for (const d of side.details) {
        d.poly.draw(ctx, {
          fill: d.fill,
          stroke: this.trimColor,
          lineWidth: 1
        });
      }
    }

    // 9. Render roof facets
    for (const roof of roofFacets) {
      roof.poly.draw(ctx, {
        fill: this.#shadeColor(this.roofColor, roof.lum),
        stroke: this.strokeColor,
        lineWidth: 1.2
      });
    }
  }
}