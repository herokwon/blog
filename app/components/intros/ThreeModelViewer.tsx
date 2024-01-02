'use client'

import { useEffect, useRef, useState } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

import Spinner from "../Spinner";

interface ThreeModelLoad {
    width: number;
    ratio: number;
    canvas: HTMLCanvasElement;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
};

export default function ThreeModelViewer() {
    const [modelLoading, setModelLoading] = useState<boolean>(true);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const setThreeModelEnv = (): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; } => {
        const scene = new THREE.Scene();  // scene 생성

        const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 100);  // camera 생성
        camera.position.set(-10, 5, 20);  // camera position 설정 - (x, y, z)

        const light = new THREE.PointLight(0xffffff, 12, 100, 1);  // light 생성 - PointLight(16진수 색상, 세기, 거리, 감쇠)
        light.position.set(0, 1, 5);  // light position 설정 - (x, y, z)

        scene.add(light);  // scene ← light 적용

        return { scene, camera };
    };

    const loadThreeModel = ({ width, ratio, canvas, scene, camera }: ThreeModelLoad) => {
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true,
        });  // renderer 생성

        renderer.setSize(width, width * ratio);  // canvas에 그려지는 model size 설정

        const controls = new OrbitControls(camera, canvas);
        const loader = new GLTFLoader();

        controls.enableDamping = true;  // 관성
        controls.enablePan = false;  // 카메라 수평 회전
        controls.enableZoom = false;  // 확대 & 축소

        loader.load("/model/scene.gltf", (object) => {
            scene.add(object.scene);
            renderer.render(scene, camera);
            setModelLoading(false);
        });

        const animate = () => {
            requestAnimationFrame(animate);

            renderer.render(scene, camera);
            controls.update();
        };
        animate();
    };

    const renderThreeModel = () => {
        if (!canvasRef.current) return;

        const rendererWidth = canvasRef.current.parentElement!.clientWidth;

        const { scene, camera } = setThreeModelEnv();
        loadThreeModel({
            width: rendererWidth,
            ratio: 0.8,
            canvas: canvasRef.current,
            scene: scene,
            camera: camera,
        });
    };

    useEffect(() => {
        renderThreeModel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        window.addEventListener("resize", renderThreeModel);
        return () => window.removeEventListener("resize", renderThreeModel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="w-full aspect-[5/4] relative">
            {modelLoading ?
                <Spinner className="absolute top-0 left-0 z-10" /> :
                null}
            <canvas id="three-model-canvas" className={`intro-focus-background w-full h-full ${modelLoading ? "opacity-off" : ""}`} ref={canvasRef} />
        </div>
    );
}