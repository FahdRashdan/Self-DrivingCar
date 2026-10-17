class Start extends Marking {
  
  constructor(center, directionVector, width, height) {
    super(center, directionVector, width, height)

    this.img = new Image();
    this.img.src = "js/car.png";
    this.type = "start";


  }

draw(ctx) {
  ctx.save();
  ctx.translate(this.center.x, this.center.y);
  ctx.rotate(angle(this.directionVector) - Math.PI / 2);

const carWidth = 20;
const carHeight = 50;

ctx.drawImage(
    this.img,
    -carWidth / 2,
    -carHeight / 2,
    carWidth,
    carHeight
);
 

  ctx.restore();
}
}