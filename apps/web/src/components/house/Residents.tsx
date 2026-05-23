"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { Profile, Room } from "@/lib/types";
import { Resident } from "./Resident";

interface Group {
  key: string;
  profile: Profile;
  room: Room;
  pinPositions: Array<[number, number, number]>;
}

export function Residents() {
  const instances = useAppStore((s) => s.instances);
  const profiles = useAppStore((s) => s.profiles);
  const templates = useAppStore((s) => s.templates);
  const rooms = useAppStore((s) => s.rooms);

  // Group every assigned-and-not-completed instance by (assignee, room).
  // One figure per group — they stand at the centroid of their pins.
  const groups = useMemo<Group[]>(() => {
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const templateById = new Map(templates.map((t) => [t.id, t]));
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const acc = new Map<string, Group>();

    for (const inst of instances) {
      if (inst.status !== "assigned" || !inst.assignee_id) continue;
      const profile = profileById.get(inst.assignee_id);
      const template = templateById.get(inst.template_id);
      const room = roomById.get(inst.room_id);
      if (!profile || !template || !room) continue;

      const key = `${inst.assignee_id}::${inst.room_id}`;
      const entry = acc.get(key) ?? {
        key,
        profile,
        room,
        pinPositions: [],
      };
      entry.pinPositions.push([
        room.position_x + template.pin.x,
        0,
        room.position_z + template.pin.z,
      ]);
      acc.set(key, entry);
    }

    return Array.from(acc.values());
  }, [instances, profiles, templates, rooms]);

  return (
    <>
      {groups.map((g) => (
        <Resident
          key={g.key}
          profile={g.profile}
          room={g.room}
          pinPositions={g.pinPositions}
        />
      ))}
    </>
  );
}
