//Canvas bRUSH - tools for drawing to HTML5 canvases
//@author Anthony -- https://igliu.com
var Crush = (function() {
    //internal helpers
    function resizeCanvas(canvas, every) {
        //adjust the parent's height to ensure you can see the whole canvas
        canvas.parentNode.style.height = Math.min(
            parseInt(canvas.parentNode.dataset.initHeight),
            document.documentElement.clientHeight-10
        ) + 'px';

        var width = canvas.parentNode.offsetWidth;
        var height = canvas.parentNode.offsetHeight;
        canvas.width = width;
        canvas.height = height;

        every([width, height]);
    }

    return {
        clear: function(ctx, color) {
            ctx.fillStyle = color || 'white';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        },
        getColorStr: function(cols, opacity) {
            var mid = '('+cols[0]+','+cols[1]+','+cols[2];
            if (arguments.length === 2) {
                return 'rgba'+mid+','+opacity+')';
            } else {
                return 'rgb'+mid+')';
            }
        },
        getGradient: function(c1, c2, percent) {
            var ret = [0, 0, 0];

            for (var ai = 0; ai < 3; ai++) {
                ret[ai] = Math.floor(Math.sqrt(
                    percent*c1[ai]*c1[ai] +
                    (1 - percent)*c2[ai]*c2[ai]
                ))%256;
            }

            return ret;
        },
        fillEllipse: function(
            ctx, center, focusDist, majAxis, thickness, color, dir,
            strokeStyle
        ) {
            color = color || 'red';
            dir = dir || 0; //0 means x is the long dimension
            strokeStyle = strokeStyle || color;

            var x = center[0];
            var y = center[1];
            var rx = majAxis;
            var ry = Math.sqrt(majAxis*majAxis - focusDist*focusDist);
            if (dir === 1) {
                var tmp = ry;
                ry = rx, rx = tmp;
            }
            ctx.fillStyle = color;
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = thickness;
            ctx.beginPath();
            if (typeof ctx.ellipse === 'function') {
                ctx.ellipse(x, y, rx, ry, 0, 0, 2*Math.PI);
            } else {
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(rx, ry);
                ctx.arc(0, 0, 1, 0, 2 * Math.PI, false);
                ctx.restore();
            }
            ctx.fill();
            ctx.stroke();
        },
        fillTriangle: function(ctx, pts, color) {
            var triangle = new Path2D();
            triangle.moveTo.apply(triangle, pts[0]);
            triangle.lineTo.apply(triangle, pts[1]);
            triangle.lineTo.apply(triangle, pts[2]);
            ctx.fillStyle = color || 'rgba(0, 0, 255, 0.3)';
            ctx.fill(triangle);
        },
        drawPoint: function(ctx, pos, r, color) {
            ctx.fillStyle = color || 'rgba(255, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(pos[0], pos[1], r, 0, 2*Math.PI, true);
            ctx.closePath();
            ctx.fill();
        },
        drawArrow: function(ctx, start, end, color) {
            //housekeeping
            color = color || 'rgba(140, 255, 255, 1)';
            var wingAngle = Math.PI/8; //in radians
            var wingLen = 20; //in pixels
            //arrow's main body
            this.drawLine(ctx, start, end, color);
            var dir = [end[0] - start[0], end[1] - start[1]];
            var theta = Math.atan(dir[1]/dir[0]);
            //calculating arrow's left wing (orientation: pointing up)
            var phi = ((Math.PI/2) - theta) - wingAngle; //angle between wing and vertical
            var leftxChange = wingLen*Math.sin(phi);
            var leftyChange = wingLen*Math.cos(phi);
            var leftEnd = [0, 0];
            if (end[0] >= start[0]) { //arrow is to the right side of the particle
                leftEnd = [end[0] - leftxChange, end[1] - leftyChange];
            } else { //left side of the particle
                leftEnd = [end[0] + leftxChange, end[1] + leftyChange];
            }
            //calculating arrow's right wing
            var psi = theta - wingAngle; //angle between wing and horizontal
            var rightxChange = wingLen*Math.cos(psi);
            var rightyChange = wingLen*Math.sin(psi);
            var rightEnd = [0, 0];
            if (end[0] >= start[0]) { //arrow is to the right side of the particle
                rightEnd = [end[0] - rightxChange, end[1] - rightyChange];
            } else { //left side of the particle
                rightEnd = [end[0] + rightxChange, end[1] + rightyChange];
            }
            //drawing the arrowhead
            this.fillTriangle(ctx, [end, leftEnd, rightEnd], color);
        },
        drawLine: function(ctx, start, end, color, thickness) {
            ctx.strokeStyle = color || 'rgba(0, 0, 0, 1)';
            ctx.beginPath();
            ctx.moveTo(start[0], start[1]);
            ctx.lineTo(end[0], end[1]);
            ctx.lineWidth = thickness || 3;
            ctx.stroke();
        },

        registerDynamicCanvas: function(canvas, every) {
            canvas.parentNode.dataset.initHeight = canvas
                .parentNode.style.height;
            resizeCanvas(canvas, every); //initial call
            window.addEventListener('resize', function() {
                resizeCanvas(canvas, every);
            });
        }
    };
})();
