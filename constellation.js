/* Interactive constellation for Black Quantum heroes.
   Nodes drift, nearby nodes link, and the pointer pulls and links to
   the ones around it. Attaches to any element with [data-constellation].
   Respects prefers-reduced-motion and pauses when scrolled out of view. */
(function () {
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hosts = document.querySelectorAll('[data-constellation]');
  if (!hosts.length) return;

  Array.prototype.forEach.call(hosts, function (host) {
    var canvas = document.createElement('canvas');
    canvas.className = 'constellation';
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var nodes = [];
    var pointer = { x: -9999, y: -9999, on: false };
    var running = false, raf = null;

    var LINK = 132;        /* node-to-node link distance */
    var REACH = 190;       /* pointer link distance */
    var NODE_RGB = '198,219,255';
    var LINE_RGB = '138,180,248';

    function makeNode() {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.30,
        vy: (Math.random() - 0.5) * 0.30,
        r: 1.7 + Math.random() * 2.3
      };
    }

    var baseCount = 0;

    function spawnHub(x, y) {
      /* a node exactly under the cursor, plus a ring of neighbours close
         enough to link to it: one click, one well-connected hub */
      nodes.push({ x: x, y: y, vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12, r: 3.8 });
      for (var i = 0; i < 7; i++) {
        var a = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
        var d = 34 + Math.random() * 52;
        nodes.push({
          x: x + Math.cos(a) * d,
          y: y + Math.sin(a) * d,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: 1.7 + Math.random() * 2.3
        });
      }
      var cap = baseCount + 96;
      if (nodes.length > cap) nodes.splice(0, nodes.length - cap);
      if (reduced) draw();
    }

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = host.clientWidth;
      H = host.clientHeight;
      if (!W || !H) return;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var target = Math.max(24, Math.min(92, Math.floor(W * H / 15000)));
      baseCount = target;
      while (nodes.length < target) nodes.push(makeNode());
      if (nodes.length > target + 96) nodes.length = target + 96;
      if (!running) draw();   /* keep a static field for reduced motion */
    }

    function step() {
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -12) n.x = W + 12; else if (n.x > W + 12) n.x = -12;
        if (n.y < -12) n.y = H + 12; else if (n.y > H + 12) n.y = -12;

        if (pointer.on) {
          var dx = pointer.x - n.x, dy = pointer.y - n.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 42000 && d2 > 1) { n.x += dx * 0.0022; n.y += dy * 0.0022; }
        }
      }
    }

    function draw() {
      if (!W || !H) return;
      ctx.clearRect(0, 0, W, H);

      ctx.lineWidth = 1;
      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
          var d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            var t = 1 - Math.sqrt(d2) / LINK;
            ctx.strokeStyle = 'rgba(' + LINE_RGB + ',' + (0.26 * t).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.stroke();
          }
        }
      }

      if (pointer.on) {
        for (var k = 0; k < nodes.length; k++) {
          var px = pointer.x - nodes[k].x, py = pointer.y - nodes[k].y;
          var pd2 = px * px + py * py;
          if (pd2 < REACH * REACH) {
            var pt = 1 - Math.sqrt(pd2) / REACH;
            ctx.strokeStyle = 'rgba(' + LINE_RGB + ',' + (0.52 * pt).toFixed(3) + ')';
            ctx.lineWidth = 1.15;
            ctx.beginPath();
            ctx.moveTo(pointer.x, pointer.y);
            ctx.lineTo(nodes[k].x, nodes[k].y);
            ctx.stroke();
          }
        }
        ctx.lineWidth = 1;
      }

      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        ctx.fillStyle = 'rgba(' + NODE_RGB + ',0.72)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame() {
      step();
      draw();
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    host.addEventListener('pointermove', function (e) {
      var b = host.getBoundingClientRect();
      pointer.x = e.clientX - b.left;
      pointer.y = e.clientY - b.top;
      pointer.on = true;
      if (reduced) draw();
    });
    host.addEventListener('pointerleave', function () {
      pointer.on = false;
      pointer.x = pointer.y = -9999;
      if (reduced) draw();
    });

    host.addEventListener('pointerdown', function (e) {
      /* don't hijack clicks on links, buttons or anything interactive */
      if (e.target.closest('a, button, input, label, select, textarea')) return;
      var b = host.getBoundingClientRect();
      spawnHub(e.clientX - b.left, e.clientY - b.top);
    });

    /* small handle for debugging and for environments that throttle rAF */
    host.__constellation = {
      step: step, draw: draw, pointer: pointer,
      count: function () { return nodes.length; }
    };

    addEventListener('resize', resize);
    resize();

    if (typeof IntersectionObserver !== 'undefined') {
      /* keep a strong reference: an unreferenced observer can be collected,
         and the field would then never resume after scrolling back */
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.isIntersecting ? start() : stop(); });
      }, { threshold: 0 });
      host.__constellationObserver = io;
      io.observe(host);
    }
    start();

    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });
  });
})();
