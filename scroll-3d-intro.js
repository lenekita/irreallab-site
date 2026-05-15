'use strict';

class ScrollIntro3D {
  constructor() {
    this.scrollProgress = 0;
    this.isNavigating = false;
    this.shapes = [];
    this.particles = null;
    this.textMesh = null;

    this.init();
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060606);

    // Camera setup
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 4;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('canvas-3d'),
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Create geometries
    this.createShapes();
    this.createParticles();
    this.createText();
    this.createLighting();

    // Event listeners
    window.addEventListener('resize', () => this.onWindowResize(), { passive: true });
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });

    // Check for reduced motion preference
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Start animation loop
    this.animate();
  }

  createShapes() {
    // Create three morphing shapes: cube, icosahedron, dodecahedron
    const materials = {
      cube: new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0xd4f03a,
        emissiveIntensity: 0.3,
        shininess: 100
      }),
      icosahedron: new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0xd4f03a,
        emissiveIntensity: 0.4,
        shininess: 100
      }),
      dodecahedron: new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0xd4f03a,
        emissiveIntensity: 0.5,
        shininess: 100
      })
    };

    this.shapes = [
      new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), materials.cube),
      new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 4), materials.icosahedron),
      new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), materials.dodecahedron)
    ];

    this.shapes.forEach((shape, index) => {
      shape.userData.index = index;
      shape.userData.baseScale = 1;
      shape.visible = index === 0; // Only show first shape initially
      this.scene.add(shape);
    });
  }

  createParticles() {
    const particleCount = 1500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Random positions in sphere around origin
      const radius = 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);

      // Random velocities
      velocities[i] = (Math.random() - 0.5) * 0.02;
      velocities[i + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i + 2] = (Math.random() - 0.5) * 0.02;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.userData.velocities = velocities;

    const material = new THREE.PointsMaterial({
      color: 0xd4f03a,
      size: 0.02,
      sizeAttenuation: true
    });

    this.particles = new THREE.Points(geometry, material);
    this.particles.userData.initialPositions = positions.slice();
    this.scene.add(this.particles);
  }

  createText() {
    // Create simple text using canvas texture
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 256;

    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#d4f03a';
    ctx.font = 'bold 120px Bebas Neue';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('irreallab', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });

    const geometry = new THREE.PlaneGeometry(4, 2);
    this.textMesh = new THREE.Mesh(geometry, material);
    this.textMesh.position.z = 0.5;
    this.textMesh.scale.set(0, 0, 1); // Start invisible
    this.scene.add(this.textMesh);
  }

  createLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Main point light (moves with scroll)
    this.mainLight = new THREE.PointLight(0xd4f03a, 1.5, 100);
    this.mainLight.position.set(5, 5, 5);
    this.scene.add(this.mainLight);

    // Secondary light
    const secondLight = new THREE.PointLight(0x4488ff, 0.8, 100);
    secondLight.position.set(-5, -5, 5);
    this.scene.add(secondLight);
  }

  onScroll() {
    if (this.prefersReducedMotion) return;

    const scrollContainer = document.getElementById('scroll-container');
    const scrollHeight = scrollContainer.scrollHeight - window.innerHeight;
    this.scrollProgress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
    this.scrollProgress = Math.min(Math.max(this.scrollProgress, 0), 1);

    // Trigger navigation at the end
    if (this.scrollProgress >= 0.99 && !this.isNavigating) {
      this.triggerNavigation();
    }
  }

  updateAnimations() {
    const progress = this.scrollProgress;

    // Update shapes visibility and rotation
    this.shapes.forEach((shape, index) => {
      let visible = false;
      let targetProgress = 0;

      if (progress < 0.33) {
        visible = index === 0;
        targetProgress = progress / 0.33;
      } else if (progress < 0.66) {
        visible = index === 1;
        targetProgress = (progress - 0.33) / 0.33;
      } else {
        visible = index === 2;
        targetProgress = (progress - 0.66) / 0.34;
      }

      shape.visible = visible;

      if (visible) {
        shape.rotation.x += 0.003;
        shape.rotation.y += 0.005;

        // Scale animation
        const scale = 0.8 + Math.sin(progress * Math.PI * 4) * 0.3;
        shape.scale.set(scale, scale, scale);
      }
    });

    // Update text
    if (this.textMesh) {
      const textProgress = Math.max(0, progress - 0.1) / 0.4; // Fade in between 10%-50%
      const textScale = Math.min(1, Math.max(0, textProgress));
      this.textMesh.scale.set(textScale, textScale, 1);
      this.textMesh.rotation.y = progress * Math.PI * 2;
      this.textMesh.opacity = textScale;
    }

    // Update particles
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      const initialPositions = this.particles.userData.initialPositions;
      const velocities = this.particles.geometry.userData.velocities;

      for (let i = 0; i < positions.length; i += 3) {
        // Update position with velocity
        positions[i] += velocities[i] * (1 + progress * 2);
        positions[i + 1] += velocities[i + 1] * (1 + progress * 2);
        positions[i + 2] += velocities[i + 2] * (1 + progress * 2);

        // Orbit effect around center
        const angle = progress * Math.PI * 2 + (i / positions.length) * Math.PI * 2;
        const orbitRadius = 2 + progress;
        const offsetX = Math.cos(angle) * orbitRadius * 0.5;
        const offsetY = Math.sin(angle) * orbitRadius * 0.5;

        positions[i] = initialPositions[i] + offsetX;
        positions[i + 1] = initialPositions[i + 1] + offsetY;

        // Fade out particles at the end
        if (progress > 0.75) {
          positions[i + 2] = initialPositions[i + 2] * (1 - (progress - 0.75) / 0.25);
        }
      }

      this.particles.geometry.attributes.position.needsUpdate = true;

      // Update particle opacity
      const particleOpacity = Math.max(0, 1 - (progress - 0.75) / 0.25);
      this.particles.material.opacity = particleOpacity;
    }

    // Update camera position
    const cameraZ = 4 + progress * 3;
    const cameraX = Math.sin(progress * Math.PI) * 2;
    this.camera.position.x += (cameraX - this.camera.position.x) * 0.1;
    this.camera.position.z = cameraZ;
    this.camera.lookAt(0, 0, 0);

    // Update lighting
    const lightIntensity = 1.5 + progress * 1;
    this.mainLight.intensity = lightIntensity;
    const hueShift = progress * 0.3;
    this.mainLight.color.setHSL(0.25 + hueShift, 1, 0.6);

    // Update scene fade for transition
    if (progress > 0.9) {
      const fadeProgress = (progress - 0.9) / 0.1;
      this.scene.background.copy(
        new THREE.Color(0x060606).lerp(new THREE.Color(0x000000), fadeProgress)
      );
    }
  }

  triggerNavigation() {
    this.isNavigating = true;

    // Fade to black and navigate
    const fadeOverlay = document.createElement('div');
    fadeOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: black;
      opacity: 0;
      z-index: 999;
      transition: opacity 1.5s ease-in-out;
    `;
    document.body.appendChild(fadeOverlay);

    // Trigger fade animation
    setTimeout(() => {
      fadeOverlay.style.opacity = '1';
    }, 10);

    // Navigate after fade completes
    setTimeout(() => {
      window.location.href = '/main.html';
    }, 1600);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (!this.prefersReducedMotion) {
      this.updateAnimations();
    }

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ScrollIntro3D();
  });
} else {
  new ScrollIntro3D();
}
