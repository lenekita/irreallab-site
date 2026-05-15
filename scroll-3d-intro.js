'use strict';

class ScrollIntro3D {
  constructor() {
    this.scrollProgress = 0;
    this.isNavigating = false;
    this.mainMesh = null;
    this.particles = null;
    this.composer = null;
    this.textMesh = null;
    this.time = 0;

    this.init();
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060606);
    this.scene.fog = new THREE.Fog(0x060606, 20, 50);

    // Camera setup
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('canvas-3d'),
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // Create geometries
    this.createOrganicShape();
    this.createParticles();
    this.createText();
    this.createLighting();
    this.setupPostProcessing();

    // Event listeners
    window.addEventListener('resize', () => this.onWindowResize(), { passive: true });
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });

    // Check for reduced motion preference
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Start animation loop
    this.animate();
  }

  createOrganicShape() {
    // Create a custom organic shape using IcosahedronGeometry with displacement
    const baseGeometry = new THREE.IcosahedronGeometry(1.2, 6);

    // Apply wave displacement to vertices for organic look
    const positionAttribute = baseGeometry.getAttribute('position');
    const positions = positionAttribute.array;
    const originalPositions = new Float32Array(positions);

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      // Apply sine waves for organic morphing
      const wave = Math.sin(x * 3) * 0.08 + Math.sin(y * 3) * 0.08 + Math.sin(z * 3) * 0.08;
      const length = Math.sqrt(x * x + y * y + z * z);

      positions[i] = x / length * (length + wave);
      positions[i + 1] = y / length * (length + wave);
      positions[i + 2] = z / length * (length + wave);
    }

    baseGeometry.userData.originalPositions = originalPositions;
    baseGeometry.userData.positions = positions;

    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0xd4f03a,
      emissiveIntensity: 0.4,
      shininess: 80,
      wireframe: false,
      flatShading: false
    });

    this.mainMesh = new THREE.Mesh(baseGeometry, material);
    this.mainMesh.scale.set(0.8, 0.8, 0.8);
    this.scene.add(this.mainMesh);
  }

  createParticles() {
    const particleCount = 800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount * 3; i += 3) {
      const radius = 2.5 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);

      sizes[i / 3] = Math.random() * 1.5 + 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.userData.initialPositions = positions.slice();

    const material = new THREE.PointsMaterial({
      color: 0xd4f03a,
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  createText() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 256;

    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#d4f03a';
    ctx.font = 'bold 100px Bebas Neue';
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
    this.textMesh.scale.set(0, 0, 1);
    this.textMesh.rotation.z = 0.1;
    this.scene.add(this.textMesh);
  }

  createLighting() {
    // Ambient light - soft and diffuse
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);

    // Main point light - moving with scroll
    this.mainLight = new THREE.PointLight(0xd4f03a, 2.5, 15);
    this.mainLight.position.set(3, 4, 5);
    this.scene.add(this.mainLight);

    // Secondary light - cool blue accent
    this.secondLight = new THREE.PointLight(0x4488ff, 1.2, 12);
    this.secondLight.position.set(-4, -3, 4);
    this.scene.add(this.secondLight);

    // Directional light for additional depth
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(5, 5, 5);
    this.scene.add(dirLight);
  }

  setupPostProcessing() {
    this.composer = new THREE.EffectComposer(this.renderer);
    const renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Bloom effect for glow
    const bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.4,
      0.85
    );
    this.composer.addPass(bloomPass);

    // Store bloom pass for dynamic adjustment
    this.bloomPass = bloomPass;
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
    this.time += 0.016; // Approximate 60fps

    // Organic mesh animation
    if (this.mainMesh) {
      // Rotation - smooth and continuous
      this.mainMesh.rotation.x += 0.0008;
      this.mainMesh.rotation.y += 0.0012;
      this.mainMesh.rotation.z += 0.0004;

      // Organic deformation based on scroll
      const geometry = this.mainMesh.geometry;
      const positions = geometry.attributes.position.array;
      const originalPositions = geometry.userData.originalPositions;

      for (let i = 0; i < positions.length; i += 3) {
        const x = originalPositions[i];
        const y = originalPositions[i + 1];
        const z = originalPositions[i + 2];

        // Sine wave displacement
        const waveAmount = Math.sin(this.time + x * 2) * 0.05 * (0.5 + progress);
        const length = Math.sqrt(x * x + y * y + z * z);

        positions[i] = (x / length) * (length + waveAmount);
        positions[i + 1] = (y / length) * (length + waveAmount);
        positions[i + 2] = (z / length) * (length + waveAmount);
      }

      geometry.attributes.position.needsUpdate = true;

      // Scale animation
      const baseScale = 0.8;
      const scaleVariation = Math.sin(progress * Math.PI * 2) * 0.15;
      const scale = baseScale + scaleVariation;
      this.mainMesh.scale.set(scale, scale, scale);

      // Color shift based on scroll
      const hueShift = progress * 0.4;
      this.mainMesh.material.emissive.setHSL(0.25 + hueShift, 1, 0.5);
    }

    // Text animation
    if (this.textMesh) {
      const textProgress = Math.max(0, progress - 0.1) / 0.35;
      const textScale = Math.min(1, Math.max(0, textProgress));

      this.textMesh.scale.set(textScale, textScale, 1);
      this.textMesh.rotation.y = progress * Math.PI * 1.5;
      this.textMesh.rotation.x = Math.sin(this.time * 0.5) * 0.1 * textScale;
      this.textMesh.position.z = 0.5 + progress * 0.5;
    }

    // Particle animation
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      const initialPositions = this.particles.geometry.userData.initialPositions;
      const particleOpacity = Math.max(0, 1 - (progress - 0.7) / 0.3);

      for (let i = 0; i < positions.length; i += 3) {
        const idx = i / 3;
        const angle = progress * Math.PI * 2 + idx;
        const distance = 2 + progress * 1.5;

        // Orbital motion
        positions[i] = Math.cos(angle) * distance + (Math.random() - 0.5) * 0.3 * progress;
        positions[i + 1] = Math.sin(angle) * distance * 0.7 + (Math.random() - 0.5) * 0.3 * progress;
        positions[i + 2] = Math.sin(angle * 0.5) * distance * 0.5;
      }

      this.particles.geometry.attributes.position.needsUpdate = true;
      this.particles.material.opacity = particleOpacity;
    }

    // Camera movement
    const cameraZ = 5 + progress * 2.5;
    const cameraX = Math.sin(progress * Math.PI) * 1.2;
    const cameraY = Math.cos(progress * Math.PI * 0.5) * 0.8;

    this.camera.position.x += (cameraX - this.camera.position.x) * 0.08;
    this.camera.position.y += (cameraY - this.camera.position.y) * 0.08;
    this.camera.position.z = cameraZ;
    this.camera.lookAt(0, 0, 0);

    // Dynamic lighting
    const lightIntensity = 2 + progress * 1.5;
    this.mainLight.intensity = lightIntensity;
    this.secondLight.intensity = 1 + progress * 0.5;

    // Bloom intensity increases with scroll
    if (this.bloomPass) {
      this.bloomPass.strength = 1 + progress * 2;
      this.bloomPass.radius = 0.4 + progress * 0.6;
    }

    // Scene fade
    if (progress > 0.9) {
      const fadeProgress = (progress - 0.9) / 0.1;
      this.scene.background.copy(
        new THREE.Color(0x060606).lerp(new THREE.Color(0x000000), fadeProgress)
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

    this.composer.render();
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
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
