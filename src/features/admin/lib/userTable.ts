import { parseTimestamp } from '@/lib/dateTime';
import {
  USER_TYPE_LABELS,
  type AccountStatus,
  type AdminUserSortColumn,
  type AdminUserSortDirection,
  type BackendUserType,
  type UserProfile,
} from '@/features/profile/types';

export interface UserTableSort {
  column: Exclude<AdminUserSortColumn, 'profile' | 'wallet' | 'tickets'>;
  direction: AdminUserSortDirection;
}

interface UserTableOptions {
  search: string;
  userType: BackendUserType | '';
  accountStatus: AccountStatus | '';
  isProfileComplete?: boolean;
  sort: UserTableSort;
}

const textOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const sortValue: Record<UserTableSort['column'], (user: UserProfile) => string | number | undefined> = {
  id: user => user.userId,
  name: user => user.fullName || undefined,
  email: user => user.email || undefined,
  phone: user => user.phoneNumber || undefined,
  role: user => USER_TYPE_LABELS[user.userType],
  status: user => user.accountStatus,
  bookings: user => user.summary.totalBookingsCount,
  assets: user => user.userType === 2 ? user.summary.ownedParkingSpotsCount : user.summary.vehicleCount,
  joined: user => {
    const time = parseTimestamp(user.createdAt).getTime();
    return Number.isFinite(time) ? time : undefined;
  },
};

export function getUserTableRows(users: UserProfile[], options: UserTableOptions): UserProfile[] {
  const { search, userType, accountStatus, isProfileComplete, sort } = options;
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const status = accountStatus.toLowerCase();
  const direction = sort.direction === 'asc' ? 1 : -1;

  return users.filter(user => {
    if (userType && user.userType !== userType) return false;
    if (status && user.accountStatus.toLowerCase() !== status) return false;
    if (isProfileComplete !== undefined && user.isProfileComplete !== isProfileComplete) return false;
    if (terms.length === 0) return true;
    const searchable = [user.fullName, user.email, user.phoneNumber, '#' + user.userId].join(' ').toLowerCase();
    return terms.every(term => searchable.includes(term));
  }).map(user => ({ user, value: sortValue[sort.column](user) })).sort((left, right) => {
    const byId = left.user.userId - right.user.userId;
    if (left.value === undefined || right.value === undefined) {
      return Number(left.value === undefined) - Number(right.value === undefined) || byId;
    }
    const order = typeof left.value === 'number' && typeof right.value === 'number'
      ? left.value - right.value
      : textOrder.compare(String(left.value), String(right.value));
    return direction * order || byId;
  }).map(({ user }) => user);
}
