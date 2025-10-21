import { RigidBody, vec3 } from "@react-three/rapier";
import { isHost } from "playroomkit";
import { useEffect, useRef } from "react";
import { MeshBasicMaterial } from "three";
import { WEAPON_OFFSET } from "./CharacterController";
import * as THREE from "three";

const BULLET_SPEED = 50;

const bulletMaterial = new MeshBasicMaterial({
  color: "orange",
  toneMapped: false,
});

bulletMaterial.color.multiplyScalar(42);

export const Bullet = ({ player, angle, position, onHit, direction }) => {
  const rigidbody = useRef();

  useEffect(() => {
    const velocity = {
      x: -direction.x * BULLET_SPEED,
      y: -direction.y * BULLET_SPEED,
      z: -direction.z * BULLET_SPEED,
    };
    rigidbody.current.setLinvel(velocity, true);
  }, [direction]);

  return (
    <group position={[position.x * 1.015, position.y, position.z]} rotation-y={angle}>
      <group
        position-z={WEAPON_OFFSET.z}
      >
        <RigidBody
          ref={rigidbody}
          gravityScale={0}
          onIntersectionEnter={(e) => {
            if (e.other.rigidBody.userData?.type !== "bullet") {
              rigidbody.current.setEnabled(false);
              onHit(vec3(rigidbody.current.translation()));
            }
          }}
          sensor
          userData={{
            type: "bullet",
            player,
            damage: 20
          }}
        >
          <mesh position-z={0.25} material={bulletMaterial} castShadow>
            <boxGeometry args={[0.025, 0.025, 0.25]} />
          </mesh>
        </RigidBody>
      </group>
    </group>
  );
};
