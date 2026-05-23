import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RoomType } from '../lib/data';
import { theme } from '../theme';

const MAP: Record<RoomType, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  bedroom: 'bed-king-outline',
  bathroom: 'shower-head',
  kitchen: 'silverware-fork-knife',
  'living-room': 'sofa-outline',
  hallway: 'door-open',
};

type Props = {
  type: RoomType;
  size?: number;
  color?: string;
};

export function RoomIcon({ type, size = 28, color = theme.colors.foreground }: Props) {
  return <MaterialCommunityIcons name={MAP[type]} size={size} color={color} />;
}
