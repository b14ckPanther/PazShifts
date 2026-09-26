/**
 * Zero-Emoji Iconography System for YellowShifts.
 *
 * Enforces a strict ZERO-EMOJI policy across all UI touchpoints.
 * Wraps modern, sleek vector icons with consistent sizing, stroke, and accessibility.
 */

import React from 'react';
import {
  Fuel,
  House,
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
  FileText,
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
  Info,
  WifiOff,
  Hourglass,
  CircleDashed,
  CalendarCheck,
  CalendarClock,
  Download,
  EllipsisVertical,
  Timer,
  LogIn,
  Nfc,
  CircleCheck,
  CircleX,
  History,
  ListChecks,
  LayoutGrid,
  type LucideProps,
} from 'lucide-react';

export interface IconProps extends LucideProps {
  className?: string;
  size?: number | string;
  strokeWidth?: number;
}

const STROKE = 1.9;

// Brand & Station Operations
export const FuelIcon: React.FC<IconProps> = (props) => <Fuel strokeWidth={STROKE} {...props} />;
export const StoreIcon: React.FC<IconProps> = (props) => <Store strokeWidth={STROKE} {...props} />;
export const StationIcon: React.FC<IconProps> = (props) => (
  <Building2 strokeWidth={STROKE} {...props} />
);
export const BuildingIcon: React.FC<IconProps> = (props) => (
  <Building2 strokeWidth={STROKE} {...props} />
);

// Authentication, Authorization & Roles
export const HomeIcon: React.FC<IconProps> = (props) => <House strokeWidth={STROKE} {...props} />;
export const UserIcon: React.FC<IconProps> = (props) => <User strokeWidth={STROKE} {...props} />;
export const UsersIcon: React.FC<IconProps> = (props) => <Users strokeWidth={STROKE} {...props} />;
export const UserPlusIcon: React.FC<IconProps> = (props) => (
  <UserPlus strokeWidth={STROKE} {...props} />
);
export const PlatformAdminIcon: React.FC<IconProps> = (props) => (
  <ShieldAlert strokeWidth={STROKE} {...props} />
);
export const ShieldAlertIcon: React.FC<IconProps> = PlatformAdminIcon;
export const StationAdminIcon: React.FC<IconProps> = (props) => (
  <ShieldCheck strokeWidth={STROKE} {...props} />
);
export const ShieldCheckIcon: React.FC<IconProps> = StationAdminIcon;
export const ShieldIcon: React.FC<IconProps> = (props) => (
  <Shield strokeWidth={STROKE} {...props} />
);
export const ManagerIcon: React.FC<IconProps> = (props) => (
  <Briefcase strokeWidth={STROKE} {...props} />
);
export const BriefcaseIcon: React.FC<IconProps> = ManagerIcon;
export const LockIcon: React.FC<IconProps> = (props) => <Lock strokeWidth={STROKE} {...props} />;
export const KeyIcon: React.FC<IconProps> = (props) => <KeyRound strokeWidth={STROKE} {...props} />;
export const EyeIcon: React.FC<IconProps> = (props) => <Eye strokeWidth={STROKE} {...props} />;
export const EyeOffIcon: React.FC<IconProps> = (props) => (
  <EyeOff strokeWidth={STROKE} {...props} />
);

// Time, Attendance & Scheduling
export const ClockIcon: React.FC<IconProps> = (props) => <Clock strokeWidth={STROKE} {...props} />;
export const CalendarIcon: React.FC<IconProps> = (props) => (
  <Calendar strokeWidth={STROKE} {...props} />
);
export const NfcIcon: React.FC<IconProps> = (props) => <Radio strokeWidth={STROKE} {...props} />;
export const QrCodeIcon: React.FC<IconProps> = (props) => (
  <QrCode strokeWidth={STROKE} {...props} />
);
export const ReportIcon: React.FC<IconProps> = (props) => (
  <FileText strokeWidth={STROKE} {...props} />
);
export const FileTextIcon: React.FC<IconProps> = ReportIcon;

// Status Indicators
export const SuccessIcon: React.FC<IconProps> = (props) => (
  <CheckCircle2 strokeWidth={STROKE} {...props} />
);
export const WarningIcon: React.FC<IconProps> = (props) => (
  <AlertTriangle strokeWidth={STROKE} {...props} />
);
export const DangerIcon: React.FC<IconProps> = (props) => (
  <AlertCircle strokeWidth={STROKE} {...props} />
);
export const ErrorIcon: React.FC<IconProps> = (props) => (
  <XCircle strokeWidth={STROKE} {...props} />
);

// Navigation & Actions
export const ChevronRightIcon: React.FC<IconProps> = (props) => (
  <ChevronRight strokeWidth={STROKE} {...props} />
);
export const ChevronLeftIcon: React.FC<IconProps> = (props) => (
  <ChevronLeft strokeWidth={STROKE} {...props} />
);
export const ChevronDownIcon: React.FC<IconProps> = (props) => (
  <ChevronDown strokeWidth={STROKE} {...props} />
);
export const MenuIcon: React.FC<IconProps> = (props) => <Menu strokeWidth={STROKE} {...props} />;
export const SearchIcon: React.FC<IconProps> = (props) => (
  <Search strokeWidth={STROKE} {...props} />
);
export const SettingsIcon: React.FC<IconProps> = (props) => (
  <Settings strokeWidth={STROKE} {...props} />
);
export const LogOutIcon: React.FC<IconProps> = (props) => (
  <LogOut strokeWidth={STROKE} {...props} />
);
export const PlusIcon: React.FC<IconProps> = (props) => <Plus strokeWidth={STROKE} {...props} />;
export const ArrowRightIcon: React.FC<IconProps> = (props) => (
  <ArrowRight strokeWidth={STROKE} {...props} />
);
export const ArrowLeftIcon: React.FC<IconProps> = (props) => (
  <ArrowLeft strokeWidth={STROKE} {...props} />
);
export const RefreshIcon: React.FC<IconProps> = (props) => (
  <RefreshCw strokeWidth={STROKE} {...props} />
);
export const CheckIcon: React.FC<IconProps> = (props) => <Check strokeWidth={STROKE} {...props} />;
export const CloseIcon: React.FC<IconProps> = (props) => <X strokeWidth={STROKE} {...props} />;
export const ExternalLinkIcon: React.FC<IconProps> = (props) => (
  <ExternalLink strokeWidth={STROKE} {...props} />
);
export const ServerIcon: React.FC<IconProps> = (props) => (
  <Server strokeWidth={STROKE} {...props} />
);
export const DatabaseIcon: React.FC<IconProps> = (props) => (
  <Database strokeWidth={STROKE} {...props} />
);
export const EditIcon: React.FC<IconProps> = (props) => <Pencil strokeWidth={STROKE} {...props} />;
export const TrashIcon: React.FC<IconProps> = (props) => <Trash2 strokeWidth={STROKE} {...props} />;
export const PowerIcon: React.FC<IconProps> = (props) => <Power strokeWidth={STROKE} {...props} />;
export const PhoneIcon: React.FC<IconProps> = (props) => <Phone strokeWidth={STROKE} {...props} />;
export const MapPinIcon: React.FC<IconProps> = (props) => (
  <MapPin strokeWidth={STROKE} {...props} />
);
export const GlobeIcon: React.FC<IconProps> = (props) => <Globe strokeWidth={STROKE} {...props} />;
export const SunIcon: React.FC<IconProps> = (props) => <Sun strokeWidth={STROKE} {...props} />;
export const MoonIcon: React.FC<IconProps> = (props) => <Moon strokeWidth={STROKE} {...props} />;
export const SendIcon: React.FC<IconProps> = (props) => <Send strokeWidth={STROKE} {...props} />;
export const CopyIcon: React.FC<IconProps> = (props) => <Copy strokeWidth={STROKE} {...props} />;
export const FilterIcon: React.FC<IconProps> = (props) => (
  <Filter strokeWidth={STROKE} {...props} />
);
export const RotateCcwIcon: React.FC<IconProps> = (props) => (
  <RotateCcw strokeWidth={STROKE} {...props} />
);
export const CheckSquareIcon: React.FC<IconProps> = (props) => (
  <CheckSquare strokeWidth={STROKE} {...props} />
);
export const SquareIcon: React.FC<IconProps> = (props) => (
  <Square strokeWidth={STROKE} {...props} />
);

// Status, time and data (redesign additions)
export const InfoIcon: React.FC<IconProps> = (props) => <Info strokeWidth={STROKE} {...props} />;
export const OfflineIcon: React.FC<IconProps> = (props) => (
  <WifiOff strokeWidth={STROKE} {...props} />
);
export const PendingIcon: React.FC<IconProps> = (props) => (
  <Hourglass strokeWidth={STROKE} {...props} />
);
export const DraftIcon: React.FC<IconProps> = (props) => (
  <CircleDashed strokeWidth={STROKE} {...props} />
);
export const CalendarCheckIcon: React.FC<IconProps> = (props) => (
  <CalendarCheck strokeWidth={STROKE} {...props} />
);
export const CalendarClockIcon: React.FC<IconProps> = (props) => (
  <CalendarClock strokeWidth={STROKE} {...props} />
);
export const DownloadIcon: React.FC<IconProps> = (props) => (
  <Download strokeWidth={STROKE} {...props} />
);
export const MoreIcon: React.FC<IconProps> = (props) => (
  <EllipsisVertical strokeWidth={STROKE} {...props} />
);
export const TimerIcon: React.FC<IconProps> = (props) => <Timer strokeWidth={STROKE} {...props} />;
export const LogInIcon: React.FC<IconProps> = (props) => <LogIn strokeWidth={STROKE} {...props} />;
export const NfcTagIcon: React.FC<IconProps> = (props) => <Nfc strokeWidth={STROKE} {...props} />;
export const CircleCheckIcon: React.FC<IconProps> = (props) => (
  <CircleCheck strokeWidth={STROKE} {...props} />
);
export const CircleXIcon: React.FC<IconProps> = (props) => (
  <CircleX strokeWidth={STROKE} {...props} />
);
export const HistoryIcon: React.FC<IconProps> = (props) => (
  <History strokeWidth={STROKE} {...props} />
);
export const ListChecksIcon: React.FC<IconProps> = (props) => (
  <ListChecks strokeWidth={STROKE} {...props} />
);
export const LayoutGridIcon: React.FC<IconProps> = (props) => (
  <LayoutGrid strokeWidth={STROKE} {...props} />
);
