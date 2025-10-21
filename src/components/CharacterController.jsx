import { Billboard, PointerLockControls, Text, PerspectiveCamera, useKeyboardControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, vec3 } from "@react-three/rapier";
import { isHost, myPlayer } from "playroomkit";
import { useEffect, useRef, useState } from "react";
import { CharacterSoldier } from "./CharacterSoldier";
import * as THREE from "three";
import { deepEqual } from '../utils'
const MOVEMENT_SPEED = 5;
const FIRE_RATE = 380;


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
  rbRef,
  setPlayersPos,
  playersPos,
  playerRbRef,
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
  const yaw = useRef(0);
  const pitch = useRef(0);
  const sensitivity = 0.002;
  const mouseupRef = useRef();


  const [, get] = useKeyboardControls();

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
    rbRef.current.setTranslation(spawnPos);
  };

  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const handleLockChange = () => {
      const locked = document.pointerLockElement !== null;
      setIsLocked(locked);
    };

    document.addEventListener("pointerlockchange", handleLockChange);
    return () => document.removeEventListener("pointerlockchange", handleLockChange);
  }, []);

  useEffect(() => {
    spawnRandomly();
  }, []);

  // ---------------------
  // AUDIO
  // ---------------------
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
  // MOUSE HANDLERS
  // ---------------------
  useEffect(() => {
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

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [userPlayer]);

  const FRAME_INTERVAL = 1 / 90; // 60 fps = 16.666... мс
  const accumulator = useRef(0);

  useFrame((_, delta) => {
    accumulator.current += delta;
    if (accumulator.current < FRAME_INTERVAL) return; // пропускаємо кадри, якщо ще не настав час
    accumulator.current = 0; // скидаємо таймер

    if (!rbRef.current || !cameraRef.current || !isLocked) return;

    const movement = { x: 0, z: 0 };
    if (get().forward) movement.z = -1;
    if (get().backward) movement.z = 1;
    if (get().left) movement.x = -1;
    if (get().right) movement.x = 1;

    // ---------------------
    // MOVEMENT
    // ---------------------

    if (userPlayer) {
      cameraRef.current.position.set(0, 1.35, -.5);
      character.current.rotation.y = yaw.current;
      cameraRef.current.rotation.x = pitch.current;

      //
      if (!playersPos[state?.id] || yaw.current !== playersPos[state.id].rotation) {
        setPlayersPos({
          ...playersPos,
          [state.id]: {
            ...playersPos[state?.id],
            rotation: yaw.current
          }
        })
      }

      const dir = new THREE.Vector3(movement.x, 0, movement.z);
      if (dir.length() > 0) {
        dir.normalize();
        setAnimation("Run");

        const angle = yaw.current;
        const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
        const right = new THREE.Vector3(Math.sin(angle + Math.PI / 2), 0, Math.cos(angle + Math.PI / 2));

        const moveDir = new THREE.Vector3();
        moveDir.addScaledVector(forward, dir.z);
        moveDir.addScaledVector(right, dir.x);
        moveDir.normalize();

        const impulse = {
          x: moveDir.x * MOVEMENT_SPEED * delta * 60,
          y: 0,
          z: moveDir.z * MOVEMENT_SPEED * delta * 60,
        }
        rbRef.current.applyImpulse(
            impulse,
            true
        );

        character.current.rotation.y = angle;

        if (!playersPos[state?.id] || !deepEqual(rbRef.current.translation(), playersPos[state.id].pos)) {
          setPlayersPos({
            [state.id]: {
              pos: rbRef.current.translation(),
              rotation: angle
            }
          })
        }
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
    }
  });

  const targetPositions = useRef({});

  useEffect(() => {
    // Коли приходять нові координати — просто оновлюємо цілі
    Object.keys(playersPos).forEach((key) => {
      if (key === state.id) return; // свого не чіпаємо
      targetPositions.current[key] = playersPos[key];
    });
  }, [playersPos]);

  useFrame(() => {
    Object.entries(targetPositions.current).forEach(([key, { pos, rotation }]) => {
      const rb = playerRbRef.current?.[key]?.current;
      if (!rb || !pos) return;

      // поточна позиція
      const current = rb.translation();

      // інтерполяція (плавне переміщення)
      const lerpPos = {
        x: THREE.MathUtils.lerp(current.x, pos.x, 0.2),
        y: THREE.MathUtils.lerp(current.y, pos.y, 0.2),
        z: THREE.MathUtils.lerp(current.z, pos.z, 0.2),
      };

      rb.setNextKinematicTranslation(lerpPos);

      // плавне обертання
      const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0));
      const currentQuat = rb.rotation();
      const slerped = new THREE.Quaternion().slerpQuaternions(currentQuat, targetQuat, 0.2);

      rb.setNextKinematicRotation(slerped);
    });
  });

  // const directionalLight = useRef();
  //
  // useEffect(() => {
  //   if (character.current && userPlayer) {
  //     directionalLight.current.target = character.current;
  //   }
  // }, [character.current]);

  return (
    <group {...props} ref={group}>
      <RigidBody
        ref={rbRef}
        colliders={false}
        linearDamping={12}
        lockRotations
        type={userPlayer ? "dynamic" : "kinematicPosition"}
        onIntersectionEnter={({ other }) => {
          if (
            other.rigidBody.userData.type === "bullet" &&
            state.state.health > 0
          ) {
            const newHealth =
              state.state.health - other.rigidBody.userData.damage;
            if (newHealth <= 0) {
              state.setState("deaths", state.state.deaths + 1);
              state.setState("dead", true);
              state.setState("health", 0);
              rbRef.current.setEnabled(false);
              setTimeout(() => {
                spawnRandomly();
                rbRef.current.setEnabled(true);
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
            />
          </group>
          {userPlayer && (
              <>
                <group ref={cameraRef}>
                  <PerspectiveCamera makeDefault fov={35} />
                  <PointerLockControls
                      onLock={() => setIsLocked(true)}
                      onUnlock={() => setIsLocked(false)}
                  />
                </group>
              </>
          )}
        </group>
        {/*{userPlayer && (*/}
        {/*  // Finally I moved the light to follow the player*/}
        {/*  // This way we won't need to calculate ALL the shadows but only the ones*/}
        {/*  // that are in the camera view*/}
        {/*  <directionalLight*/}
        {/*    ref={directionalLight}*/}
        {/*    position={[25, 18, -25]}*/}
        {/*    intensity={0.3}*/}
        {/*    castShadow={!downgradedPerformance} // Disable shadows on low-end devices*/}
        {/*    shadow-camera-near={0}*/}
        {/*    shadow-camera-far={100}*/}
        {/*    shadow-camera-left={-20}*/}
        {/*    shadow-camera-right={20}*/}
        {/*    shadow-camera-top={20}*/}
        {/*    shadow-camera-bottom={-20}*/}
        {/*    shadow-mapSize-width={2048}*/}
        {/*    shadow-mapSize-height={2048}*/}
        {/*    shadow-bias={-0.0001}*/}
        {/*  />*/}
        {/*)}*/}
        <CapsuleCollider args={[0.7, 0.6]} position={[0, 1.28, 0]} />
      </RigidBody>
    </group>
  );
};

const PlayerInfo = ({ state }) => {
  const health = state.health;
  const name = state.profile.name;
  return (
    <Billboard position-y={2.5} rotation-y={Math.PI / 2}>
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
