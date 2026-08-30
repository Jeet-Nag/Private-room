"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type CoreState = "ROOM_CREATED" | "PARTICIPANT_JOINED" | "CALL_ACTIVE" | "FILE_TRANSFER" | "MEDIA_PLAYING";

interface RoomCore3DProps {
  isEncrypted?: boolean;
  participantCount?: number;
  isAudioActive?: boolean;
  state?: CoreState;
  compact?: boolean;
}

export const RoomCore3D: React.FC<RoomCore3DProps> = ({
  isEncrypted = true,
  participantCount = 1,
  isAudioActive = false,
  state = "ROOM_CREATED",
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setHasWebGL(false);
      return;
    }

    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || (compact ? 120 : 320);
    const height = container.clientHeight || (compact ? 120 : 320);

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let coreMesh: THREE.Mesh;
    let particleMesh: THREE.Points;
    let outerRing: THREE.LineSegments;
    let animationFrameId: number;

    try {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = compact ? 5 : 4.2;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Inner Encrypted Core
      const coreGeo = new THREE.IcosahedronGeometry(1.0, 1);
      const coreColor = state === "CALL_ACTIVE" ? 0x3a86ff : state === "MEDIA_PLAYING" ? 0x9d4edd : 0x00f2fe;
      
      const coreMat = new THREE.MeshBasicMaterial({
        color: coreColor,
        wireframe: true,
        transparent: true,
        opacity: 0.8,
      });
      coreMesh = new THREE.Mesh(coreGeo, coreMat);
      scene.add(coreMesh);

      // Outer Orbital Particle Cloud
      const particleCountNum = compact ? 80 : 260;
      const particleGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCountNum * 3);
      const colors = new Float32Array(particleCountNum * 3);

      const color1 = new THREE.Color(coreColor);
      const color2 = new THREE.Color(0x9d4edd);

      for (let i = 0; i < particleCountNum; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const radius = 1.4 + Math.random() * 0.6;

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);

        const mixed = color1.clone().lerp(color2, Math.random());
        colors[i * 3] = mixed.r;
        colors[i * 3 + 1] = mixed.g;
        colors[i * 3 + 2] = mixed.b;
      }

      particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const particleMat = new THREE.PointsMaterial({
        size: compact ? 0.04 : 0.055,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });

      particleMesh = new THREE.Points(particleGeo, particleMat);
      scene.add(particleMesh);

      // Cyber Perimeter Ring
      const ringGeo = new THREE.RingGeometry(1.9, 1.92, 48);
      const ringEdges = new THREE.EdgesGeometry(ringGeo);
      const ringMat = new THREE.LineBasicMaterial({
        color: 0x3a86ff,
        transparent: true,
        opacity: 0.45,
      });
      outerRing = new THREE.LineSegments(ringEdges, ringMat);
      outerRing.rotation.x = Math.PI / 3;
      scene.add(outerRing);

      let time = 0;
      const animate = () => {
        time += 0.015;
        const baseSpeed = state === "CALL_ACTIVE" ? 0.025 : state === "FILE_TRANSFER" ? 0.03 : 0.009;
        const speed = isAudioActive ? baseSpeed * 2.2 : baseSpeed;

        coreMesh.rotation.x += speed;
        coreMesh.rotation.y += speed * 1.2;

        particleMesh.rotation.y -= speed * 0.7;
        particleMesh.rotation.z += speed * 0.4;

        outerRing.rotation.z += speed * 0.5;

        // Dynamic pulsing
        const pulseFrequency = state === "MEDIA_PLAYING" || isAudioActive ? 4 : 2;
        const pulseAmplitude = state === "CALL_ACTIVE" ? 0.07 : 0.035;
        const scalePulse = 1.0 + Math.sin(time * pulseFrequency) * pulseAmplitude;
        coreMesh.scale.set(scalePulse, scalePulse, scalePulse);

        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(animate);
      };

      animate();

      const handleResize = () => {
        if (!container) return;
        const newW = container.clientWidth || width;
        const newH = container.clientHeight || height;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      };

      window.addEventListener("resize", handleResize);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", handleResize);
        if (renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    } catch (err) {
      console.warn("WebGL initialization failed, falling back to CSS:", err);
      setHasWebGL(false);
    }
  }, [isEncrypted, participantCount, isAudioActive, state, compact]);

  if (!hasWebGL) {
    return (
      <div className={`relative flex items-center justify-center ${compact ? "w-24 h-24" : "w-64 h-64"} select-none`}>
        <div className="absolute inset-0 rounded-full border border-phantom-cyan/30 animate-spin" style={{ animationDuration: "12s" }} />
        <div className="absolute inset-3 rounded-full border border-dashed border-phantom-purple/40 animate-spin" style={{ animationDuration: "8s", animationDirection: "reverse" }} />
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-phantom-cyan/20 to-phantom-purple/20 border border-phantom-cyan/60 flex items-center justify-center backdrop-blur-md shadow-cyan-glow">
          <div className="w-4 h-4 rounded-sm bg-phantom-cyan animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${compact ? "w-28 h-28" : "w-full max-w-[360px] h-[340px]"} cursor-pointer`}
      aria-label="Phantom Room 3D Security Core Visualizer"
    />
  );
};
