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
    // Minimaliste: Wireframe Sphere
    const baseGeometry = new THREE.IcosahedronGeometry(1, 4);
    const originalPositions = new Float32Array(baseGeometry.getAttribute('position').array);

    // Wireframe material - clean, minimal aesthetic
    const material = new THREE.MeshStandardMaterial({
      color: 0xd4f03a,
      emissive: 0xd4f03a,
      emissiveIntensity: 0.8,
      metalness: 0.3,
      roughness: 0.8,
      wireframe: true
    });

    this.mainMesh = new THREE.Mesh(baseGeometry, material);
    this.mainMesh.scale.set(1, 1, 1);
    this.mainMesh.userData.originalPositions = originalPositions;
    this.scene.add(this.mainMesh);
  }

  createParticles() {
    // Minimaliste: 75 slow-floating points
    const particleCount = 75;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Spread particles in space around origin
      positions[i] = (Math.random() - 0.5) * 12;
      positions[i + 1] = (Math.random() - 0.5) * 12;
      positions[i + 2] = (Math.random() - 0.5) * 12;

      // Slow random velocities
      velocities[i] = (Math.random() - 0.5) * 0.01;
      velocities[i + 1] = (Math.random() - 0.5) * 0.01;
      velocities[i + 2] = (Math.random() - 0.5) * 0.01;

      // Subtle lime-green color with slight variation
      const color = new THREE.Color().setHSL(0.22, 0.8, 0.55);
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData.initialPositions = positions.slice();
    geometry.userData.velocities = velocities;

    const material = new THREE.PointsMaterial({
      size: 0.08,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.6
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
    // Minimaliste: 2 lights only
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Single key light - lime accent
    this.mainLight = new THREE.PointLight(0xd4f03a, 2, 40);
    this.mainLight.position.set(5, 5, 8);
    this.scene.add(this.mainLight);
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

    // Minimaliste: Slow, subtle rotation
    if (this.mainMesh) {
      // Slow, gentle rotation - 1/3 current speed
      this.mainMesh.rotation.x += 0.0005;
      this.mainMesh.rotation.y += 0.0008;
      this.mainMesh.rotation.z += 0.0002;

      // Minimal subtle breathing effect
      const breathing = 1 + Math.sin(this.time * 0.1) * 0.05;
      this.mainMesh.scale.set(breathing, breathing, breathing);

      // Keep color consistent - no shifting
      this.mainMesh.material.emissiveIntensity = 0.8;
    }

    // Text animation - Fade in at 20%, minimal movement
    if (this.textMesh) {
      const textProgress = Math.max(0, progress - 0.2) / 0.3;
      const textScale = Math.min(1, Math.max(0, textProgress));

      this.textMesh.scale.set(textScale, textScale, 1);
      this.textMesh.rotation.y = 0; // No rotation - static
      this.textMesh.rotation.x = 0;
      this.textMesh.position.z = 1; // Static position
      this.textMesh.position.y = 0;
    }

    // Particle animation - Slow floating motion
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      const velocities = this.particles.geometry.userData.velocities;
      const initialPositions = this.particles.geometry.userData.initialPositions;

      if (positions && velocities) {
        for (let i = 0; i < positions.length; i += 3) {
          // Apply slow velocity
          positions[i] += velocities[i];
          positions[i + 1] += velocities[i + 1];
          positions[i + 2] += velocities[i + 2];

          // Wrap around boundaries to keep particles visible
          if (Math.abs(positions[i]) > 6) positions[i] = -positions[i];
          if (Math.abs(positions[i + 1]) > 6) positions[i + 1] = -positions[i + 1];
          if (Math.abs(positions[i + 2]) > 6) positions[i + 2] = -positions[i + 2];
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
      }

      // Particles fade out slightly near end
      const particleOpacity = Math.max(0, 1 - (progress - 0.85) / 0.15);
      this.particles.material.opacity = particleOpacity * 0.6;
    }

    // Camera: Gentle approach (subtle zoom in)
    const cameraZ = 6 + progress * (-2); // Slow zoom from 6 to 4
    this.camera.position.z = cameraZ;
    this.camera.lookAt(0, 0, 0);

    // Lighting: Static intensity - no dynamic changes
    this.mainLight.intensity = 2;

    // Scene fade - start at 90%, end at 100%
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
