'use strict';

class ScrollIntro3D {
  constructor() {
    this.scrollProgress = 0;
    this.isNavigating = false;
    this.mainMesh = null;
    this.particles = null;
    this.textMesh = null;
    this.time = 0;

    this.init();
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);
    this.scene.fog = new THREE.Fog(0x0a0a0a, 30, 50);

    // Camera setup
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.z = 6;

    // Renderer setup - HIGH QUALITY
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('canvas-3d'),
      antialias: true,
      alpha: false,
      precision: 'highp'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;

    // Create 3D elements
    this.createOrganicShape();
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

  createOrganicShape() {
    // Create elegant hexagon - 6-sided cylinder prism
    const baseGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.35, 6, 4, false);

    const positions = baseGeometry.getAttribute('position').array;
    const originalPositions = new Float32Array(positions);

    // Apply subtle, elegant wave displacement
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      const length = Math.sqrt(x * x + y * y + z * z);

      if (length > 0.01) {
        // More subtle waves - creates flowing distortion rather than lumpy shape
        const wave = Math.sin(x * 8) * 0.08 + Math.cos(y * 6) * 0.06 + Math.sin(z * 7) * 0.05;
        const newLength = length + wave;

        positions[i] = (x / length) * newLength;
        positions[i + 1] = (y / length) * newLength;
        positions[i + 2] = (z / length) * newLength;
      }
    }

    baseGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    baseGeometry.computeVertexNormals();

    // Sophisticated material with vibrant accent color
    const material = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      emissive: 0xd4f03a,
      emissiveIntensity: 1.5,
      metalness: 0.6,
      roughness: 0.2,
      wireframe: false
    });

    this.mainMesh = new THREE.Mesh(baseGeometry, material);
    this.mainMesh.rotation.z = Math.PI / 6;
    this.mainMesh.scale.set(1.2, 1.2, 1.2);
    this.mainMesh.userData.originalPositions = originalPositions;
    this.scene.add(this.mainMesh);
  }

  createParticles() {
    const particleCount = 1500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      const radius = 2.5 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);

      // Vibrant lime-green to cyan gradient
      const hue = 0.18 + Math.random() * 0.25; // Range from lime to cyan
      const saturation = 0.9 + Math.random() * 0.1; // Very saturated
      const lightness = 0.5 + Math.random() * 0.2; // Bright particles
      const color = new THREE.Color().setHSL(hue, saturation, lightness);
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData.initialPositions = positions.slice();

    const material = new THREE.PointsMaterial({
      size: 0.12,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  createText() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 512;

    // Transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Large glowing text
    ctx.fillStyle = '#d4f03a';
    ctx.font = 'bold 180px Bebas Neue, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(212, 240, 58, 0.8)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText('irreallab', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });

    const geometry = new THREE.PlaneGeometry(6, 3);
    this.textMesh = new THREE.Mesh(geometry, material);
    this.textMesh.position.z = 1;
    this.textMesh.scale.set(0, 0, 1);
    this.scene.add(this.textMesh);
  }

  createLighting() {
    // Dim ambient light for depth
    const ambientLight = new THREE.AmbientLight(0x0a0a0a, 0.3);
    this.scene.add(ambientLight);

    // Main point light - vibrant neon lime
    this.mainLight = new THREE.PointLight(0xd4f03a, 4, 30);
    this.mainLight.position.set(5, 6, 8);
    this.scene.add(this.mainLight);

    // Secondary light - deep purple/magenta accent
    this.secondLight = new THREE.PointLight(0xff00ff, 2, 25);
    this.secondLight.position.set(-6, -5, 7);
    this.scene.add(this.secondLight);

    // Tertiary light - cyan accent
    const thirdLight = new THREE.PointLight(0x00ffff, 1.5, 20);
    thirdLight.position.set(3, -6, -8);
    this.scene.add(thirdLight);

    // Directional light for subtle volume
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight.position.set(5, 5, 5);
    this.scene.add(dirLight);
  }

  onScroll() {
    if (this.prefersReducedMotion) return;

    const scrollContainer = document.getElementById('scroll-container');
    const scrollHeight = scrollContainer.scrollHeight - window.innerHeight;
    this.scrollProgress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
    this.scrollProgress = Math.min(Math.max(this.scrollProgress, 0), 1);

    // Auto-navigate at the very end
    if (this.scrollProgress >= 0.99 && !this.isNavigating) {
      this.triggerNavigation();
    }
  }

  updateAnimations() {
    const progress = this.scrollProgress;
    this.time += 0.016;

    // Elegant shape animation
    if (this.mainMesh) {
      // Smooth, fluid rotation
      this.mainMesh.rotation.x += 0.0015;
      this.mainMesh.rotation.y += 0.0025;
      this.mainMesh.rotation.z += 0.0008;

      // Subtle, flowing deformation
      const geometry = this.mainMesh.geometry;
      const positions = geometry.getAttribute('position').array;
      const originalPositions = this.mainMesh.userData.originalPositions;

      if (originalPositions) {
        for (let i = 0; i < positions.length; i += 3) {
          const x = originalPositions[i];
          const y = originalPositions[i + 1];
          const z = originalPositions[i + 2];
          const length = Math.sqrt(x * x + y * y + z * z);

          // Elegant, flowing deformation
          const waveAmount = Math.sin(this.time * 0.8 + x * 4) * 0.08 + Math.cos(this.time * 0.6 + y * 3) * 0.06;
          const deformAmount = waveAmount * (0.5 + progress * 0.7);
          const newLength = length + deformAmount;

          positions[i] = (x / length) * newLength;
          positions[i + 1] = (y / length) * newLength;
          positions[i + 2] = (z / length) * newLength;
        }

        geometry.attributes.position.needsUpdate = true;
      }

      // Elegant scale pulsing
      const scale = 1 + Math.sin(this.time * 0.4 + progress * Math.PI * 2) * 0.2 + progress * 0.15;
      this.mainMesh.scale.set(scale, scale, scale);

      // Vibrant color shift through spectrum
      const hue = 0.18 + progress * 0.5; // Lime to magenta
      this.mainMesh.material.emissive.setHSL(hue, 1, 0.65);
      this.mainMesh.material.emissiveIntensity = 1.2 + progress * 0.6;
    }

    // Text animation - LARGER and MORE VISIBLE
    if (this.textMesh) {
      const textProgress = Math.max(0, progress - 0.08) / 0.35;
      const textScale = Math.min(1, Math.max(0, textProgress));

      this.textMesh.scale.set(textScale, textScale, 1);
      this.textMesh.rotation.y = progress * Math.PI * 1.5;
      this.textMesh.rotation.x = Math.sin(this.time * 0.4) * 0.2 * textScale;
      this.textMesh.position.z = 1 + progress * 1;
      this.textMesh.position.y = Math.sin(this.time * 0.3) * 0.3 * textScale;
    }

    // Particle animation - MORE DYNAMIC
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      const initialPositions = this.particles.geometry.userData.initialPositions;

      if (positions && initialPositions) {
        for (let i = 0; i < positions.length; i += 3) {
          const idx = i / 3;
          const angle = progress * Math.PI * 3 + idx * 0.01;
          const orbitDistance = 2.8 + progress * 1.8;

          positions[i] = Math.cos(angle) * orbitDistance;
          positions[i + 1] = Math.sin(angle) * orbitDistance * 0.8;
          positions[i + 2] = Math.sin(angle * 0.5) * orbitDistance * 0.6;
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
      }

      // Particle opacity
      const particleOpacity = Math.max(0, 1 - (progress - 0.75) / 0.25);
      this.particles.material.opacity = particleOpacity;
    }

    // Camera movement - MORE DRAMATIC
    const cameraZ = 6 + progress * 3;
    const cameraX = Math.sin(progress * Math.PI) * 2;
    const cameraY = Math.cos(progress * Math.PI * 0.5) * 1.5;

    this.camera.position.x += (cameraX - this.camera.position.x) * 0.08;
    this.camera.position.y += (cameraY - this.camera.position.y) * 0.08;
    this.camera.position.z = cameraZ;
    this.camera.lookAt(0, 0, 0);

    // Dynamic lighting - STRONGER
    const lightIntensity = 3 + progress * 2.5;
    this.mainLight.intensity = lightIntensity;
    this.secondLight.intensity = 1.2 + progress * 1;

    // Scene fade
    if (progress > 0.9) {
      const fadeAmount = (progress - 0.9) / 0.1;
      this.scene.background.copy(
        new THREE.Color(0x0a0a0a).lerp(new THREE.Color(0x000000), fadeAmount)
      );
    }
  }

  triggerNavigation() {
    this.isNavigating = true;

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

    setTimeout(() => {
      fadeOverlay.style.opacity = '1';
    }, 10);

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
