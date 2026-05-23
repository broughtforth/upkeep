"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import type {
  Profile,
  Room,
  TaskInstanceWithDetails,
} from "@upkeep/shared";
import { assignRoomTo } from "@/app/actions";
import { PeopleList } from "./sidebar/PeopleList";
import { TaskList } from "./sidebar/TaskList";
import { House } from "./house/House";

type Props = {
  rooms: Room[];
  people: Profile[];
  instances: TaskInstanceWithDetails[];
};

// Top-level layout for the admin dashboard:
//   [ People sidebar ] [ 3D house canvas ] [ Tasks sidebar ]
//
// Drag a person card from the left onto a room in the centre to assign
// them every pending task in that room for today.
export function DashboardClient({ rooms, people, instances }: Props) {
  const [pending, startTransition] = useTransition();
  // Tracks the most-recent drop so we can flash visual feedback.
  const [lastDrop, setLastDrop] = useState<{
    roomId: string;
    userId: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Avoid hijacking simple clicks on draggable cards.
      activationConstraint: { distance: 6 },
    }),
  );

  function onDragEnd(event: DragEndEvent) {
    const personId = String(event.active.id);
    const roomId = event.over?.id ? String(event.over.id) : null;
    if (!roomId) return;

    setLastDrop({ roomId, userId: personId });
    startTransition(async () => {
      await assignRoomTo(roomId, personId);
    });
  }

  // Group instances by room for the centre column status colouring and the
  // right-hand task list.
  const instancesByRoom = new Map<string | null, TaskInstanceWithDetails[]>();
  for (const i of instances) {
    const key = i.room_id ?? null;
    const list = instancesByRoom.get(key) ?? [];
    list.push(i);
    instancesByRoom.set(key, list);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid h-[calc(100vh-7rem)] grid-cols-[260px_1fr_320px] gap-4">
        <PeopleList people={people} />
        <House
          rooms={rooms}
          instancesByRoom={instancesByRoom}
          highlightedRoomId={lastDrop?.roomId ?? null}
          assigning={pending}
        />
        <TaskList instances={instances} />
      </div>
    </DndContext>
  );
}
