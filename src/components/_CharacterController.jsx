import {Billboard, CameraControls, PointerLockControls, Text, PerspectiveCamera} from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, vec3 } from "@react-three/rapier";
import { isHost } from "playroomkit";
import { useEffect, useRef, useState } from "react";
import { CharacterSoldier } from "./CharacterSoldier";
import * as THREE from "three";
const MOVEMENT_SPEED = 5;
const FIRE_RATE = 380;
import { CameraHelper } from 'three';

export const WEAPON_OFFSET = {
  x: 0,
  y: 1.35,
  z: -0.7,
};

export const CharacterController = ({
  state,
  joystick,
  userPlayer,
  onKilled,
  onFire,
  downgradedPerformance,
  ...props
}) => {
  const group = useRef();
  const character = useRef();
  const rigidbody = useRef();
  const [animation, setAnimation] = useState("Idle");
  const [weapon, setWeapon] = useState("AK");
  const lastShoot = useRef(0);
  const scene = useThree((state) => state.scene);

  const cameraRef = useRef();
  const [keys, setKeys] = useState({});
  const yaw = useRef(0);
  const pitch = useRef(0);
  const sensitivity = 0.002;
  const mouseupRef = useRef();

  const moveX = useRef(0);
  let moveZ= useRef(0);

  const spawnRandomly = () => {
    const spawns = [];
    for (let i = 0; i < 1000; i++) {
      const spawn = scene.getObjectByName(`spawn_${i}`);
      if (spawn) {
        spawns.push(spawn);
      } else {
        break;
      }
    }
    const spawnPos = spawns[Math.floor(Math.random() * spawns.length)].position;
    rigidbody.current.setTranslation(spawnPos);
  };

  useEffect(() => {
    if (isHost()) {
      spawnRandomly();
    }
  }, []);

  useEffect(() => {
    if (state.state.dead) {
      const audio = new Audio("/audios/dead.mp3");
      audio.volume = 0.5;
      audio.play();
    }
  }, [state.state.dead]);

  useEffect(() => {
    if (state.state.health < 100) {
      const audio = new Audio("/audios/hurt.mp3");
      audio.volume = 0.4;
      audio.play();
    }
  }, [state.state.health]);


  // ---------------------
  // KEYBOARD HANDLERS
  // ---------------------
  useEffect(() => {
    const down = (e) => setKeys((k) => ({ ...k, [e.code]: true }));
    const up = (e) => setKeys((k) => ({ ...k, [e.code]: false }));
    const onMouseUp   = () => mouseupRef.current = false
    const onMouseDown = () => {
      setAnimation("Idle_Shoot");
      mouseupRef.current = true
    }
    const onMouseMove = (e) => {
      yaw.current -= e.movementX * sensitivity;
      pitch.current -= e.movementY * sensitivity;
      pitch.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch.current));
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, []);


  useEffect(() => {
    if (keys["KeyW"]) moveZ.current -= 1;
    if (keys["KeyS"]) moveZ.current += 1;
    if (keys["KeyA"]) moveX.current -= 1;
    if (keys["KeyD"]) moveX.current += 1;
  }, [keys])
  // ---------------------
  // CAMERA FOLLOW
  // ---------------------
  useFrame((_, delta) => {
    if (!rigidbody.current || !userPlayer) return;

    if (!cameraRef.current || !character.current) return;

    // Камера сидить у голові
    if (userPlayer) {
      cameraRef.current.position.set(0, 1.35,3.5);
    }

    character.current.rotation.y = yaw.current;
    cameraRef.current.rotation.x = pitch.current;
  });

  useFrame((_, delta) => {
    if (!rigidbody.current || !userPlayer) return;

    if (state.state.dead) {
      setAnimation("Death");
      return;
    }

    // ---------------------
    // MOVEMENT LOGIC (WASD)
    // ---------------------

    const dir = new THREE.Vector3(moveX.current, 0, moveZ.current);
    if (dir.length() > 0 && userPlayer) {
      dir.normalize();
      setAnimation("Run");

      // обчислюємо напрям погляду з yaw
      const angle = yaw.current;
      const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const right = new THREE.Vector3(Math.sin(angle + Math.PI / 2), 0, Math.cos(angle + Math.PI / 2));

      // комбінуємо напрямок з W/A/S/D
      const moveDir = new THREE.Vector3();
      moveDir.addScaledVector(forward, dir.z);
      moveDir.addScaledVector(right, dir.x);
      moveDir.normalize();

      // рухаємо rigidbody
      rigidbody.current.applyImpulse(
          {
            x: moveDir.x * MOVEMENT_SPEED * delta * 60,
            y: 0,
            z: moveDir.z * MOVEMENT_SPEED * delta * 60,
          },
          true
      );

      // розвертаємо персонажа у напрямку руху
      character.current.rotation.y = angle;
    } else {
      setAnimation("Idle");
    }

    // ---------------------
    // FIRE LOGIC (як було)
    // ---------------------
    if (mouseupRef.current) {

      if (cameraRef && (Date.now() - lastShoot.current) > FIRE_RATE) {

        // Отримуємо напрямок у світових координатах
        const direction = new THREE.Vector3();
        cameraRef.current?.getWorldDirection(direction);
        direction.normalize();

// Отримуємо позицію камери у світових координатах
        const origin = new THREE.Vector3();
        cameraRef.current.getWorldPosition(origin);

// Множимо напрямок на швидкість
        const BULLET_SPEED = 50;
        const velocity = {
          x: direction.x * BULLET_SPEED,
          y: direction.y * BULLET_SPEED,
          z: direction.z * BULLET_SPEED,
        };

// Створюємо кулю трохи перед камерою
        const muzzlePos = origin.clone().add(direction.clone().multiplyScalar(0.5));

        lastShoot.current = Date.now();
        const newBullet = {
          id: state.id + "-" + +new Date(),
          player: state.id,
          position: muzzlePos,
          direction,
          angle: character.current.rotation.y
        };

        onFire(newBullet);
        setAnimation("Idle")
      }
    }

    // ---------------------
    // SYNC POS
    // ---------------------
    if (isHost()) {
      state.setState("pos", rigidbody.current.translation());
    } else {
      const pos = state.getState("pos");
      if (pos) {
        rigidbody.current.setTranslation(pos);
      }
    }
  });


  const controls = useRef();
  const directionalLight = useRef();

  useEffect(() => {
    if (character.current && userPlayer) {
      directionalLight.current.target = character.current;
    }
  }, [character.current]);

  return (
    <group {...props} ref={group}>
      {/*{userPlayer && <CameraControls ref={controls} />}*/}
      <RigidBody
        ref={rigidbody}
        colliders={false}
        linearDamping={12}
        lockRotations
        type={isHost() ? "dynamic" : "kinematicPosition"}
        onIntersectionEnter={({ other }) => {
          if (
            isHost() &&
            other.rigidBody.userData.type === "bullet" &&
            state.state.health > 0
          ) {
            const newHealth =
              state.state.health - other.rigidBody.userData.damage;
            if (newHealth <= 0) {
              state.setState("deaths", state.state.deaths + 1);
              state.setState("dead", true);
              state.setState("health", 0);
              rigidbody.current.setEnabled(false);
              setTimeout(() => {
                spawnRandomly();
                rigidbody.current.setEnabled(true);
                state.setState("health", 100);
                state.setState("dead", false);
              }, 2000);
              onKilled(state.id, other.rigidBody.userData.player);
            } else {
              state.setState("health", newHealth);
            }
          }
        }}
      >
        <PlayerInfo state={state.state} />
        <group ref={character}>
          <group rotation-y={Math.PI}>
            <CharacterSoldier
                color={state.state.profile?.color}
                animation={animation}
                weapon={weapon}
                isHost={isHost()}
            />
          </group>
          {userPlayer && (
              <>
                <group ref={cameraRef}>
                  <PerspectiveCamera makeDefault fov={35} />
                  <PointerLockControls />
                </group>
              </>
          )}
        </group>
        {userPlayer && (
          // Finally I moved the light to follow the player
          // This way we won't need to calculate ALL the shadows but only the ones
          // that are in the camera view
          <directionalLight
            ref={directionalLight}
            position={[25, 18, -25]}
            intensity={0.3}
            castShadow={!downgradedPerformance} // Disable shadows on low-end devices
            shadow-camera-near={0}
            shadow-camera-far={100}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.0001}
          />
        )}
        <CapsuleCollider args={[0.7, 0.6]} position={[0, 1.28, 0]} />
      </RigidBody>
    </group>
  );
};

const PlayerInfo = ({ state }) => {
  const health = state.health;
  const name = state.profile.name;
  return (
    <Billboard position-y={2.5}>
      <Text position-y={0.36} fontSize={0.4}>
        {name}
        <meshBasicMaterial color={state.profile.color} />
      </Text>
      <mesh position-z={-0.1}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="black" transparent opacity={0.5} />
      </mesh>
      <mesh scale-x={health / 100} position-x={-0.5 * (1 - health / 100)}>
        <planeGeometry args={[1, 0.2]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </Billboard>
  );
};
