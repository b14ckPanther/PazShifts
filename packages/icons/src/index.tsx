/**
 * Zero-Emoji Iconography System for YellowShifts.
 *
 * Enforces a strict ZERO-EMOJI policy across all UI touchpoints.
 * Wraps modern, sleek vector icons with consistent sizing, stroke, and accessibility.
 */

import React from 'react';
import {
  Fuel,
  Store,
  Building2,
  User,
  Users,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Briefcase,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Menu,
  Search,
  Settings,
  LogOut,
  Plus,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  QrCode,
  KeyRound,
  Check,
  X,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Radio,
  Server,
  Database,
  Pencil,
  Trash2,
  Power,
  UserPlus,
  Phone,
  MapPin,
  Globe,
  Sun,
  Moon,
  Send,
  Copy,
  Filter,
  RotateCcw,
  CheckSquare,
  Square,
  type LucideProps,
} from 'lucide-react';

export interface IconProps extends LucideProps {
  className?: string;
  size?: number | string;
  strokeWidth?: number;
}

// Brand & Station Operations
export const FuelIcon: React.FC<IconProps> = (props) => <Fuel {...props} />;
export const StoreIcon: React.FC<IconProps> = (props) => <Store {...props} />;
export const StationIcon: React.FC<IconProps> = (props) => <Building2 {...props} />;
export const BuildingIcon: React.FC<IconProps> = (props) => <Building2 {...props} />;

// Authentication, Authorization & Roles
export const UserIcon: React.FC<IconProps> = (props) => <User {...props} />;
export const UsersIcon: React.FC<IconProps> = (props) => <Users {...props} />;
export const UserPlusIcon: React.FC<IconProps> = (props) => <UserPlus {...props} />;
export const PlatformAdminIcon: React.FC<IconProps> = (props) => <ShieldAlert {...props} />;
export const ShieldAlertIcon: React.FC<IconProps> = PlatformAdminIcon;
export const StationAdminIcon: React.FC<IconProps> = (props) => <ShieldCheck {...props} />;
export const ShieldCheckIcon: React.FC<IconProps> = StationAdminIcon;
export const ShieldIcon: React.FC<IconProps> = (props) => <Shield {...props} />;
export const ManagerIcon: React.FC<IconProps> = (props) => <Briefcase {...props} />;
export const BriefcaseIcon: React.FC<IconProps> = ManagerIcon;
export const LockIcon: React.FC<IconProps> = (props) => <Lock {...props} />;
export const KeyIcon: React.FC<IconProps> = (props) => <KeyRound {...props} />;
export const EyeIcon: React.FC<IconProps> = (props) => <Eye {...props} />;
export const EyeOffIcon: React.FC<IconProps> = (props) => <EyeOff {...props} />;

// Time, Attendance & Scheduling
export const ClockIcon: React.FC<IconProps> = (props) => <Clock {...props} />;
export const CalendarIcon: React.FC<IconProps> = (props) => <Calendar {...props} />;
export const NfcIcon: React.FC<IconProps> = (props) => <Radio {...props} />;
export const QrCodeIcon: React.FC<IconProps> = (props) => <QrCode {...props} />;

// Status Indicators
export const SuccessIcon: React.FC<IconProps> = (props) => <CheckCircle2 {...props} />;
export const WarningIcon: React.FC<IconProps> = (props) => <AlertTriangle {...props} />;
export const DangerIcon: React.FC<IconProps> = (props) => <AlertCircle {...props} />;
export const ErrorIcon: React.FC<IconProps> = (props) => <XCircle {...props} />;

// Navigation & Actions
export const ChevronRightIcon: React.FC<IconProps> = (props) => <ChevronRight {...props} />;
export const ChevronLeftIcon: React.FC<IconProps> = (props) => <ChevronLeft {...props} />;
export const ChevronDownIcon: React.FC<IconProps> = (props) => <ChevronDown {...props} />;
export const MenuIcon: React.FC<IconProps> = (props) => <Menu {...props} />;
export const SearchIcon: React.FC<IconProps> = (props) => <Search {...props} />;
export const SettingsIcon: React.FC<IconProps> = (props) => <Settings {...props} />;
export const LogOutIcon: React.FC<IconProps> = (props) => <LogOut {...props} />;
export const PlusIcon: React.FC<IconProps> = (props) => <Plus {...props} />;
export const ArrowRightIcon: React.FC<IconProps> = (props) => <ArrowRight {...props} />;
export const ArrowLeftIcon: React.FC<IconProps> = (props) => <ArrowLeft {...props} />;
export const RefreshIcon: React.FC<IconProps> = (props) => <RefreshCw {...props} />;
export const CheckIcon: React.FC<IconProps> = (props) => <Check {...props} />;
export const CloseIcon: React.FC<IconProps> = (props) => <X {...props} />;
export const ExternalLinkIcon: React.FC<IconProps> = (props) => <ExternalLink {...props} />;
export const ServerIcon: React.FC<IconProps> = (props) => <Server {...props} />;
export const DatabaseIcon: React.FC<IconProps> = (props) => <Database {...props} />;
export const EditIcon: React.FC<IconProps> = (props) => <Pencil {...props} />;
export const TrashIcon: React.FC<IconProps> = (props) => <Trash2 {...props} />;
export const PowerIcon: React.FC<IconProps> = (props) => <Power {...props} />;
export const PhoneIcon: React.FC<IconProps> = (props) => <Phone {...props} />;
export const MapPinIcon: React.FC<IconProps> = (props) => <MapPin {...props} />;
export const GlobeIcon: React.FC<IconProps> = (props) => <Globe {...props} />;
export const SunIcon: React.FC<IconProps> = (props) => <Sun {...props} />;
export const MoonIcon: React.FC<IconProps> = (props) => <Moon {...props} />;
export const SendIcon: React.FC<IconProps> = (props) => <Send {...props} />;
export const CopyIcon: React.FC<IconProps> = (props) => <Copy {...props} />;
export const FilterIcon: React.FC<IconProps> = (props) => <Filter {...props} />;
export const RotateCcwIcon: React.FC<IconProps> = (props) => <RotateCcw {...props} />;
export const CheckSquareIcon: React.FC<IconProps> = (props) => <CheckSquare {...props} />;
export const SquareIcon: React.FC<IconProps> = (props) => <Square {...props} />;
