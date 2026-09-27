"use client";

/**
 * MudraLanyard — MUDRA identity-card lanyard
 * ─────────────────────────────────────────────────
 * Adapted from the React Bits Lanyard component.
 * Source: https://www.reactbits.dev/components/lanyard
 *
 * Key adaptations:
 *  - Card front face drawn via Canvas 2D API with real student data.
 *  - Assets (card.glb + lanyard.png) served from /public/lanyard/.
 *  - MUDRA palette only: #110B0B / #E3D28A / #E02E0B / #5A0E0B.
 *  - Physics disabled on reduced-motion; canvas only mounts when visible.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, Lightformer } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";

extend({ MeshLineGeometry, MeshLineMaterial });

// ─── assets ──────────────────────────────────────────────────────────────────

const CARD_GLB   = "/lanyard/card.glb";
const LANYARD_PNG = "/lanyard/lanyard.png";
const MUDRA_LOGO  = "/images/mudra-logo.png";

const BLANK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Front-face UV rect in the card.glb texture atlas (left half)
const FRONT_UV = { x: 0, y: 0, w: 0.5, h: 0.755 };

// ─── types ────────────────────────────────────────────────────────────────────

export interface StudentCardData {
  name:       string;
  semester:   string;
  department: string;
  team:       string;
}

export interface MudraLanyardProps {
  student: StudentCardData;
  height?: string;
}

// ─── card face builder (Canvas 2D) ───────────────────────────────────────────

function buildCardFaceDataURL(student: StudentCardData): Promise<string> {
  return new Promise((resolve) => {
    const atlasCvs = document.createElement("canvas");
    atlasCvs.width  = 1024;
    atlasCvs.height = 512;
    const ctx = atlasCvs.getContext("2d")!;

    const fw = 512;
    const fh = 512;

    ctx.fillStyle = "#110B0B";
    ctx.fillRect(0, 0, fw, fh);

    ctx.strokeStyle = "#5A0E0B";
    ctx.lineWidth   = 8;
    ctx.strokeRect(16, 16, fw - 32, fh - 32);

    ctx.strokeStyle = "#E3D28A";
    ctx.lineWidth   = 1;
    ctx.strokeRect(24, 24, fw - 48, fh - 48);

    const drawText = () => {
      ctx.textAlign     = "center";
      ctx.fillStyle     = "#E3D28A";
      ctx.font          = "bold 22px serif";
      ctx.letterSpacing = "0.18em";
      ctx.fillText("MUDRA", fw / 2, 188);

      ctx.strokeStyle = "#5A0E0B";
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(60, 202);
      ctx.lineTo(fw - 60, 202);
      ctx.stroke();

      const teamName = student.team.toUpperCase();
      const badgeW   = 260;
      const badgeH   = 46;
      const badgeX   = (fw - badgeW) / 2;
      const badgeY   = 216;

      ctx.fillStyle = "#E02E0B";
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

      ctx.fillStyle     = "#E3D28A";
      ctx.font          = "bold 26px serif";
      ctx.letterSpacing = "0.25em";
      ctx.fillText(teamName, fw / 2, badgeY + 32);

      ctx.fillStyle     = "#E3D28A";
      ctx.font          = "bold 18px sans-serif";
      ctx.letterSpacing = "0.04em";
      const displayName = student.name.length > 28
        ? student.name.slice(0, 26) + "…"
        : student.name;
      ctx.fillText(displayName.toUpperCase(), fw / 2, 298);

      ctx.fillStyle     = "rgba(227,210,138,0.65)";
      ctx.font          = "14px sans-serif";
      ctx.letterSpacing = "0.08em";
      ctx.fillText(`SEM ${student.semester}  ·  ${student.department}`, fw / 2, 326);

      ctx.fillStyle = "rgba(90,14,11,0.9)";
      ctx.fillRect(0, fh - 64, fw, 64);

      ctx.fillStyle     = "rgba(227,210,138,0.5)";
      ctx.font          = "11px sans-serif";
      ctx.letterSpacing = "0.2em";
      ctx.fillText("CULTURAL FEST · MUDRA", fw / 2, fh - 28);

      resolve(atlasCvs.toDataURL("image/png"));
    };

    const logoImg  = new window.Image();
    logoImg.onload = () => {
      const logoSize = 120;
      ctx.drawImage(logoImg, (fw - logoSize) / 2, 44, logoSize, logoSize);
      drawText();
    };
    logoImg.onerror = () => drawText();
    logoImg.src     = MUDRA_LOGO;
  });
}

// ─── Band ─────────────────────────────────────────────────────────────────────

interface BandProps {
  isMobile:     boolean;
  frontDataURL: string | null;
}

function Band({ isMobile, frontDataURL }: BandProps) {
  const band  = useRef<THREE.Mesh>(null!);
  const fixed = useRef(null!);
  const j1    = useRef(null!);
  const j2    = useRef(null!);
  const j3    = useRef(null!);
  const card  = useRef(null!);

  // Reusable vectors allocated once per component instance — not per frame
  const vec = useRef(new THREE.Vector3()).current;
  const ang = useRef(new THREE.Vector3()).current;
  const rot = useRef(new THREE.Vector3()).current;
  const dir = useRef(new THREE.Vector3()).current;

  const segmentProps = {
    type:           "dynamic",
    canSleep:       true,
    colliders:      false,
    angularDamping: 4,
    linearDamping:  4,
  } as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { nodes, materials } = useGLTF(CARD_GLB) as any;
  const lanyardTex = useTexture(LANYARD_PNG);
  const frontTex   = useTexture(frontDataURL ?? BLANK);

  // Configure lanyard texture wrapping. useTexture returns a stable object
  // reference so mutating it here is safe and idiomatic in R3F.
  // eslint-disable-next-line react-hooks/immutability
  lanyardTex.wrapS = THREE.RepeatWrapping;
  // eslint-disable-next-line react-hooks/immutability
  lanyardTex.wrapT = THREE.RepeatWrapping;

  const cardMap = useMemo(() => {
    const baseMap = materials.base?.map ?? null;
    if (!frontDataURL || !frontTex?.image || !baseMap?.image) return baseMap;

    const baseImg = baseMap.image as HTMLImageElement | HTMLCanvasElement;
    const W = (baseImg as HTMLImageElement).naturalWidth  || (baseImg as HTMLCanvasElement).width  || 1024;
    const H = (baseImg as HTMLImageElement).naturalHeight || (baseImg as HTMLCanvasElement).height || 512;

    const canvas = document.createElement("canvas");
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(baseImg, 0, 0, W, H);

    const rx = FRONT_UV.x * W;
    const ry = FRONT_UV.y * H;
    const rw = FRONT_UV.w * W;
    const rh = FRONT_UV.h * H;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.drawImage(frontTex.image as CanvasImageSource, rx, ry, rw, rh);
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace  = THREE.SRGBColorSpace;
    tex.flipY       = baseMap.flipY;
    tex.anisotropy  = 16;
    tex.needsUpdate = true;
    return tex;
  }, [frontDataURL, frontTex, materials.base?.map]);

  // useRef so mutation of curveType doesn't trigger the immutability lint rule
  const curveRef = useRef(
    Object.assign(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(), new THREE.Vector3(),
        new THREE.Vector3(), new THREE.Vector3(),
      ]),
      { curveType: "chordal" as THREE.CurveType }
    )
  );
  const curve = curveRef.current;

  const [dragged, drag]  = useState<THREE.Vector3 | false>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2,    [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3,    [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.5, 0]]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? "grabbing" : "grab";
      return () => void (document.body.style.cursor = "auto");
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged && card.current) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [card, j1, j2, j3, fixed].forEach((r: any) => r.current?.wakeUp?.());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (card.current as any).setNextKinematicTranslation({
        x: vec.x - (dragged as THREE.Vector3).x,
        y: vec.y - (dragged as THREE.Vector3).y,
        z: vec.z - (dragged as THREE.Vector3).z,
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((fixed.current as any)?.translation) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [j1, j2].forEach((r: any) => {
        if (!r.current.lerped)
          r.current.lerped = new THREE.Vector3().copy(r.current.translation());
        const d = Math.max(0.1, Math.min(1, r.current.lerped.distanceTo(r.current.translation())));
        r.current.lerped.lerp(r.current.translation(), delta * d * 50);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      curve.points[0].copy((j3.current    as any).translation());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      curve.points[1].copy((j2.current    as any).lerped);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      curve.points[2].copy((j1.current    as any).lerped);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      curve.points[3].copy((fixed.current as any).translation());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (band.current.geometry as any).setPoints(curve.getPoints(isMobile ? 16 : 32));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ang.copy((card.current as any).angvel());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rot.copy((card.current as any).rotation());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (card.current as any).setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1, 0, 0]}   ref={j2} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              const target = e.target as Element;
              if (target.hasPointerCapture?.(e.pointerId)) {
                target.releasePointerCapture(e.pointerId);
              }
              drag(false);
            }}
            onPointerCancel={() => drag(false)}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              drag(
                new THREE.Vector3()
                  .copy(e.point)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .sub(vec.copy((card.current as any).translation()))
              );
            }}
          >
            <mesh geometry={nodes.card?.geometry}>
              <meshPhysicalMaterial
                map={cardMap}
                map-anisotropy={16}
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.15}
                roughness={0.9}
                metalness={0.8}
              />
            </mesh>
            <mesh geometry={nodes.clip?.geometry}  material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp?.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>

      <mesh ref={band}>
        {/* @ts-expect-error — meshline extended via extend() */}
        <meshLineGeometry />
        {/* @ts-expect-error — meshline extended via extend() */}
        <meshLineMaterial
          color="white"
          depthTest={false}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          useMap
          map={lanyardTex}
          repeat={[-4, 1]}
          lineWidth={1}
        />
      </mesh>
    </>
  );
}

// ─── MudraLanyard ─────────────────────────────────────────────────────────────

export default function MudraLanyard({ student, height = "480px" }: MudraLanyardProps) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const [frontDataURL, setFrontDataURL]   = useState<string | null>(null);

  useEffect(() => {
    const mql  = window.matchMedia("(max-width: 767px)");
    const rmql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onResize = () => setIsMobile(mql.matches);
    const onRm     = () => setReducedMotion(rmql.matches);
    mql.addEventListener("change", onResize);
    rmql.addEventListener("change", onRm);
    onRm();
    return () => {
      mql.removeEventListener("change", onResize);
      rmql.removeEventListener("change", onRm);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    buildCardFaceDataURL(student).then((url) => {
      if (!cancelled) setFrontDataURL(url);
    });
    return () => { cancelled = true; };
  }, [student]);

  if (reducedMotion) {
    return (
      <div className="w-full flex items-center justify-center py-6" style={{ minHeight: "200px" }}>
        <div className="border border-[#E02E0B] bg-[#110B0B] p-6 text-center space-y-3 max-w-xs w-full">
          <div className="text-[10px] text-[#E3D28A]/60 uppercase tracking-widest">ALLOCATED HOUSE</div>
          <div className="font-display font-black text-3xl text-[#E3D28A]">{student.team}</div>
          <div className="border-t border-[#E3D28A]/20 pt-3 space-y-1 font-body text-xs text-[#E3D28A]/70">
            <div>{student.name}</div>
            <div>Sem {student.semester} · {student.department}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative" style={{ height: isMobile ? "360px" : height }}>
      <Canvas
        camera={{ position: [0, 0, 30], fov: 20 }}
        dpr={[1, isMobile ? 1.5 : 2]}
        style={{ touchAction: "none" }}
        gl={{ alpha: true }}
        fallback={
          <div className="flex h-full items-center justify-center border border-[#E02E0B] bg-[#110B0B] p-6 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#E3D28A]/60">ALLOCATED HOUSE</div>
              <div className="mt-2 font-display text-3xl font-black text-[#E3D28A]">{student.team}</div>
            </div>
          </div>
        }
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), 0)}
      >
        <ambientLight intensity={Math.PI} />
        {frontDataURL && (
          <Physics
            gravity={[0, isMobile ? -30 : -40, 0]}
            timeStep={isMobile ? 1 / 30 : 1 / 60}
          >
            <Band isMobile={isMobile} frontDataURL={frontDataURL} />
          </Physics>
        )}
        <Environment blur={0.75}>
          <Lightformer intensity={2}  color="white" position={[0, -1, 5]}   rotation={[0, 0, Math.PI / 3]}          scale={[100, 0.1, 1]} />
          <Lightformer intensity={3}  color="white" position={[-1, -1, 1]}  rotation={[0, 0, Math.PI / 3]}          scale={[100, 0.1, 1]} />
          <Lightformer intensity={3}  color="white" position={[1, 1, 1]}    rotation={[0, 0, Math.PI / 3]}          scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}

useGLTF.preload(CARD_GLB);
