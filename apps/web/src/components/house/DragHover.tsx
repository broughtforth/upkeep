"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Raycaster, Vector2 } from "three";
import { useAppStore } from "@/lib/store";

// During a dnd-kit drag, the original draggable element receives the pointer
// events — they don't reliably reach r3f's internal pointer-event raycaster.
// So while dragging, we install our own document-level pointermove listener
// and raycast against the scene to discover which room is under the cursor.
// Each room's group carries `userData.roomId`; we traverse up from the hit.
export function DragHover() {
  const { camera, scene, gl } = useThree();
  const draggingProfileId = useAppStore((s) => s.draggingProfileId);
  const raycaster = useRef(new Raycaster());
  const ndc = useRef(new Vector2());

  useEffect(() => {
    if (!draggingProfileId) {
      // Clear stale hover state when the drag ends.
      const s = useAppStore.getState();
      if (s.hoveredRoomId !== null || s.hoveredInstanceId !== null) {
        useAppStore.setState({ hoveredRoomId: null, hoveredInstanceId: null });
      }
      return;
    }

    const findTarget = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      // Pointer must be within the canvas bounds — otherwise no drop target.
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        const s = useAppStore.getState();
        if (s.hoveredRoomId !== null || s.hoveredInstanceId !== null) {
          useAppStore.setState({ hoveredRoomId: null, hoveredInstanceId: null });
        }
        return;
      }

      ndc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(ndc.current, camera);
      const intersects = raycaster.current.intersectObjects(scene.children, true);

      // Walk every hit and the ancestors of each hit. The first hit that
      // carries an instanceId wins (a pin is the most-specific drop target);
      // otherwise we fall back to the room.
      let instanceId: string | null = null;
      let roomId: string | null = null;
      for (const hit of intersects) {
        let obj: typeof hit.object | null = hit.object;
        while (obj) {
          const iid = obj.userData?.instanceId;
          if (!instanceId && typeof iid === "string") instanceId = iid;
          const rid = obj.userData?.roomId;
          if (!roomId && typeof rid === "string") roomId = rid;
          obj = obj.parent;
        }
        if (instanceId) break; // pin wins outright
        if (roomId) break;
      }

      const s = useAppStore.getState();
      if (s.hoveredRoomId !== roomId || s.hoveredInstanceId !== instanceId) {
        useAppStore.setState({ hoveredRoomId: roomId, hoveredInstanceId: instanceId });
      }
    };

    document.addEventListener("pointermove", findTarget);
    return () => document.removeEventListener("pointermove", findTarget);
  }, [draggingProfileId, camera, scene, gl]);

  return null;
}
