import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

type RawJob = {
  id?: string
  title?: string
  companyName?: string
  companyLogo?: string
  location?: string
  workplaceType?: string
  description?: string
  jobPostingUrl?: string
  postedAt?: string
}

type Job = {
  id: string
  title: string
  company: string
  logo?: string
  location: string
  workType: 'Remote' | 'Hybrid' | 'Onsite' | 'Unknown'
  seniority: 'Entry' | 'Mid' | 'Senior'
  experience: string
  techStack: string[]
  description: string
  applyLink: string
  postedAt: string
  matchScore: number
  matchedSkills: string[]
  missingSkills: string[]
}

type ColumnId = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected'

type TrackerState = {
  columns: Record<ColumnId, string[]>
  notes: Record<string, string>
  appliedAt: Record<string, string>
}

type UserProfile = {
  skills: string[]
  experienceYears: number | null
  source: 'default' | 'resume'
  resumeFileName?: string
}

type DailyFeedPayload = {
  generatedAt?: string
  source?: string
  total?: number
  jobs?: RawJob[]
}

const USER_SKILLS = [
  'python',
  'c++',
  'java',
  'machine learning',
  'deep learning',
  'nlp',
  'computer vision',
  'opencv',
  'react',
  'react native',
  'node.js',
  'express',
  'flask',
  'fastapi',
  'system design',
  'computer networking',
  'operating systems',
  'android development',
  'iot',
  'hardware integration',
  'llm',
  'prompt engineering',
]

const IMPORTANT_SKILLS = new Set([
  'machine learning',
  'deep learning',
  'nlp',
  'computer vision',
  'opencv',
  'fastapi',
  'llm',
])

const TECH_DICTIONARY = [
  'python',
  'java',
  'c++',
  'react',
  'node',
  'express',
  'flask',
  'fastapi',
  'tensorflow',
  'pytorch',
  'nlp',
  'llm',
  'opencv',
  'aws',
  'docker',
  'kubernetes',
  'sql',
  'mongodb',
  'redis',
  'android',
  'iot',
  'embedded',
  'linux',
]

const MOCK_RAW_JOBS: RawJob[] = [
  {
    id: 'ln-1001',
    title: 'Full Stack ML Engineer (CV + Edge)',
    companyName: 'NeuroForge Labs',
    companyLogo: 'https://logo.clearbit.com/nvidia.com',
    location: 'San Francisco, CA (Hybrid)',
    workplaceType: 'hybrid',
    description:
      'Build edge vision pipelines using Python, C++, OpenCV, PyTorch, and FastAPI. Deploy on AWS with Docker and Kubernetes. 3-5 years experience. Work on embedded IoT sensors and LLM-assisted annotation tools.',
    jobPostingUrl: 'https://example.com/job/1001',
    postedAt: '2026-03-30',
  },
  {
    id: 'ln-1002',
    title: 'Backend Engineer - Java / Spring',
    companyName: 'LedgerCloud',
    companyLogo: 'https://logo.clearbit.com/oracle.com',
    location: 'Austin, TX (Onsite)',
    workplaceType: 'onsite',
    description:
      'Design microservices in Java, Spring, Kafka, and MySQL. 5+ years required. Focus on reliability and compliance. Experience with AWS and Kubernetes is a plus.',
    jobPostingUrl: 'https://example.com/job/1002',
    postedAt: '2026-03-26',
  },
  {
    id: 'ln-1003',
    title: 'Senior React + Node Engineer',
    companyName: 'SignalWorks',
    companyLogo: 'https://logo.clearbit.com/stripe.com',
    location: 'Remote',
    workplaceType: 'remote',
    description:
      'Own frontend and API delivery for our SaaS suite. React, Node, Express, MongoDB, and Redis. 4-6 years. Bonus: LLM integrations and system design.',
    jobPostingUrl: 'https://example.com/job/1003',
    postedAt: '2026-03-28',
  },
  {
    id: 'ln-1004',
    title: 'Embedded Software Engineer',
    companyName: 'Aether Robotics',
    companyLogo: 'https://logo.clearbit.com/intel.com',
    location: 'Berlin, Germany (Hybrid)',
    workplaceType: 'hybrid',
    description:
      'Build C++ firmware for robotics, Linux, embedded systems, networking, and IoT connectivity. 2-4 years. Experience with computer vision is a plus.',
    jobPostingUrl: 'https://example.com/job/1004',
    postedAt: '2026-03-22',
  },
  {
    id: 'ln-1005',
    title: 'Data Scientist - NLP',
    companyName: 'LexiAI',
    companyLogo: 'https://logo.clearbit.com/openai.com',
    location: 'Remote',
    workplaceType: 'remote',
    description:
      'Apply NLP and LLM techniques to semantic search. Python, TensorFlow, PyTorch, and FastAPI. 0-2 years or MS/PhD.',
    jobPostingUrl: 'https://example.com/job/1005',
    postedAt: '2026-03-27',
  },
  {
    id: 'ln-1006',
    title: 'Android Systems Engineer',
    companyName: 'Pulse Mobile',
    companyLogo: 'https://logo.clearbit.com/samsung.com',
    location: 'Seoul, Korea (Onsite)',
    workplaceType: 'onsite',
    description:
      'Android development with Java/Kotlin, OS services, networking, and hardware integration. 3-5 years. IoT device integration required.',
    jobPostingUrl: 'https://example.com/job/1006',
    postedAt: '2026-03-25',
  },
  {
    id: 'ln-1007',
    title: 'Cloud Platform Engineer',
    companyName: 'InfraGlow',
    companyLogo: 'https://logo.clearbit.com/google.com',
    location: 'London, UK (Hybrid)',
    workplaceType: 'hybrid',
    description:
      'Kubernetes, Docker, Redis, SQL, Terraform. Build scalable cloud runtime with Java and Python. 4-7 years.',
    jobPostingUrl: 'https://example.com/job/1007',
    postedAt: '2026-03-20',
  },
  {
    id: 'ln-1008',
    title: 'Junior Full Stack Developer',
    companyName: 'Trellis Digital',
    companyLogo: '',
    location: 'Toronto, CA (Remote)',
    workplaceType: 'remote',
    description:
      'SDE1 role building React and Node.js features. 0-1 years, willingness to learn. AWS exposure preferred.',
    jobPostingUrl: 'https://example.com/job/1008',
    postedAt: '2026-03-21',
  },
  {
    id: 'ln-1009',
    title: 'Senior CV Research Engineer',
    companyName: 'Visionary Autonomy',
    companyLogo: 'https://logo.clearbit.com/tesla.com',
    location: 'Palo Alto, CA (Onsite)',
    workplaceType: 'onsite',
    description:
      'Lead computer vision research with PyTorch, OpenCV, and Linux. 5-8 years. Strong system design required.',
    jobPostingUrl: 'https://example.com/job/1009',
    postedAt: '2026-03-19',
  },
  {
    id: 'ln-1010',
    title: 'Product Engineer - UI Focus',
    companyName: 'Nimbus Studio',
    companyLogo: 'https://logo.clearbit.com/figma.com',
    location: 'Remote',
    workplaceType: 'remote',
    description:
      'React, TypeScript, design systems, and Node.js. 2-4 years. Bonus: prompt engineering and LLM UX.',
    jobPostingUrl: 'https://example.com/job/1010',
    postedAt: '2026-03-24',
  },
]

const TRACKER_STORAGE_KEY = 'job-command-center:tracker:v1'
const RAW_JOBS_STORAGE_KEY = 'job-command-center:raw:v2'
const FEED_ENDPOINT = '/data/jobs.json'

const EMPTY_TRACKER: TrackerState = {
  columns: {
    saved: [],
    applied: [],
    interviewing: [],
    offer: [],
    rejected: [],
  },
  notes: {},
  appliedAt: {},
}

const matchScoreColor = (score: number) => {
  if (score >= 80) return 'from-emerald-400 to-teal-300'
  if (score >= 50) return 'from-amber-400 to-orange-300'
  return 'from-rose-400 to-red-300'
}

const normalizeText = (text: string) => text.toLowerCase()

const INDIA_LOCATION_HINTS = [
  'india',
  'karnataka',
  'maharashtra',
  'tamil nadu',
  'telangana',
  'uttar pradesh',
  'haryana',
  'gujarat',
  'west bengal',
  'andhra pradesh',
  'kerala',
  'rajasthan',
  'punjab',
  'ncr',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'pune',
  'mumbai',
  'delhi',
  'new delhi',
  'noida',
  'gurgaon',
  'gurugram',
  'chennai',
  'kolkata',
  'ahmedabad',
  'kochi',
  'trivandrum',
  'thiruvananthapuram',
  'jaipur',
  'chandigarh',
  'indore',
  'bhubaneswar',
  'coimbatore',
  'lucknow',
  'nagpur',
  'surat',
  'vadodara',
]

const isIndiaLocation = (location: string) => {
  const normalized = normalizeText(location)
  return INDIA_LOCATION_HINTS.some((hint) => normalized.includes(hint))
}

const passesGeoPolicyUi = (job: Job) => {
  if (isIndiaLocation(job.location)) {
    return true
  }
  return job.workType === 'Remote'
}

const decodeHtmlEntities = (text: string) => {
  if (typeof document === 'undefined') return text
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

const formatDescription = (description: string) => {
  const withBreaks = description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|ul|ol)>/gi, '\n')
    .replace(/<li>/gi, '• ')

  const stripped = withBreaks.replace(/<[^>]*>/g, '')
  const decoded = decodeHtmlEntities(stripped)

  return decoded
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

const mapSkillAliases = (skill: string) => {
  if (skill === 'node.js') return 'node'
  if (skill === 'react native') return 'react'
  if (skill === 'android development') return 'android'
  return skill
}

const extractTech = (text: string) => {
  const normalized = normalizeText(text)
  return TECH_DICTIONARY.filter((tech) => normalized.includes(tech))
}

const detectWorkType = (text: string) => {
  const normalized = normalizeText(text)
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('onsite') || normalized.includes('on-site')) return 'Onsite'
  return 'Unknown'
}

const detectSeniority = (text: string): Job['seniority'] => {
  const normalized = normalizeText(text)
  if (
    /sde1|junior|entry|graduate|intern|0\s?-\s?2/.test(normalized)
  ) {
    return 'Entry'
  }
  if (/staff|principal|lead|senior|5\+/.test(normalized)) {
    return 'Senior'
  }
  return 'Mid'
}

const detectExperience = (text: string) => {
  const match = text.match(/(\d+)\s?[-–]\s?(\d+)\s?years?/i)
  if (match) return `${match[1]}-${match[2]} years`
  return 'Not specified'
}

const extractResumeSkills = (text: string) => {
  const normalized = normalizeText(text)
  const candidates = new Set([
    ...USER_SKILLS.map((skill) => normalizeText(skill)),
    ...TECH_DICTIONARY.map((skill) => normalizeText(skill)),
  ])

  return Array.from(candidates).filter((skill) => {
    if (skill.includes('+')) {
      return normalized.includes(skill)
    }
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}\\b`, 'i')
    return re.test(normalized)
  })
}

const extractResumeExperienceYears = (text: string) => {
  const normalized = normalizeText(text)
  const matches = Array.from(
    normalized.matchAll(/(\d+)\+?\s+years?/g),
    (match) => Number(match[1]),
  )
  if (matches.length === 0) return null
  return Math.max(...matches)
}

const scoreJob = (techStack: string[], userSkills: string[]) => {
  if (techStack.length === 0) {
    return { matchScore: 0, matchedSkills: [], missingSkills: [] }
  }
  const normalizedUser = userSkills.map((skill) => normalizeText(skill))
  const normalizedTech = techStack.map((skill) => normalizeText(skill))
  const weightedTotal = normalizedTech.reduce((total, skill) => {
    const canonical = mapSkillAliases(skill)
    return total + (IMPORTANT_SKILLS.has(canonical) ? 2 : 1)
  }, 0)

  const matched = normalizedTech.filter((skill) =>
    normalizedUser.includes(mapSkillAliases(skill)),
  )

  const weightedMatched = matched.reduce((total, skill) => {
    const canonical = mapSkillAliases(skill)
    return total + (IMPORTANT_SKILLS.has(canonical) ? 2 : 1)
  }, 0)

  const score = Math.min(100, Math.round((weightedMatched / weightedTotal) * 100))
  const missing = normalizedTech.filter(
    (skill) => !matched.includes(skill),
  )

  return {
    matchScore: score,
    matchedSkills: matched,
    missingSkills: missing,
  }
}

const normalizeJob = (raw: RawJob, index: number, userSkills: string[]): Job => {
  const title = raw.title ?? 'Untitled Role'
  const company = raw.companyName ?? 'Unknown Company'
  const location = raw.location ?? 'Unknown'
  const description = formatDescription(raw.description ?? 'No description provided.')
  const techStack = extractTech(`${title} ${description}`)
  const { matchScore, matchedSkills, missingSkills } = scoreJob(techStack, userSkills)

  return {
    id: raw.id ?? `${company}-${index}`,
    title,
    company,
    logo: raw.companyLogo || undefined,
    location,
    workType: detectWorkType(`${raw.workplaceType ?? ''} ${location} ${description}`),
    seniority: detectSeniority(`${title} ${description}`),
    experience: detectExperience(description),
    techStack,
    description,
    applyLink: raw.jobPostingUrl ?? '',
    postedAt: raw.postedAt ?? 'Unknown',
    matchScore,
    matchedSkills,
    missingSkills,
  }
}

const parseFeedPayload = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return {
      jobs: payload as RawJob[],
      generatedAt: undefined,
      source: 'array-feed',
    }
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as DailyFeedPayload
    if (Array.isArray(obj.jobs)) {
      return {
        jobs: obj.jobs,
        generatedAt: obj.generatedAt,
        source: obj.source ?? 'object-feed',
      }
    }
  }

  return {
    jobs: null,
    generatedAt: undefined,
    source: undefined,
  }
}

const formatDate = (value: string) => {
  if (value === 'Unknown') return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const daysAgo = (value?: string) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000)
  return diff <= 0 ? 'today' : `${diff}d ago`
}

const useDebouncedValue = (value: string, delay = 300) => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(handle)
  }, [value, delay])

  return debounced
}

const getInitials = (company: string) =>
  company
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const loadTrackerState = (): TrackerState => {
  const stored = localStorage.getItem(TRACKER_STORAGE_KEY)
  if (!stored) return EMPTY_TRACKER
  try {
    const parsed = JSON.parse(stored) as TrackerState
    return {
      columns: parsed.columns ?? EMPTY_TRACKER.columns,
      notes: parsed.notes ?? {},
      appliedAt: parsed.appliedAt ?? {},
    }
  } catch {
    return EMPTY_TRACKER
  }
}

const persistTrackerState = (state: TrackerState) => {
  localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(state))
}

const ColumnTitle: Record<ColumnId, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
}

const columnOrder: ColumnId[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
]

type SortableCardProps = {
  job: Job
  note: string
  onNoteChange: (value: string) => void
  badgeColor: string
  appliedLabel?: string | null
}

const SortableCard = ({
  job,
  note,
  onNoteChange,
  badgeColor,
  appliedLabel,
}: SortableCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass rounded-2xl p-4 space-y-3 border border-white/10 ${
        isDragging ? 'opacity-70 shadow-lift' : 'shadow-glass'
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            {job.company}
          </p>
          <p className="text-lg font-semibold text-white">{job.title}</p>
          <p className="text-xs text-slate-400">{job.location}</p>
        </div>
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r ${badgeColor} text-slate-900`}
        >
          {job.matchScore}%
        </span>
      </div>
      {appliedLabel && (
        <div className="text-xs text-emerald-200 mono">Applied {appliedLabel}</div>
      )}
      <textarea
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Notes..."
        className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
        rows={3}
      />
    </div>
  )
}

type KanbanColumnProps = {
  columnId: ColumnId
  title: string
  count: number
  items: string[]
  children: ReactNode
}

const KanbanColumn = ({ columnId, title, count, items, children }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: columnId })

  return (
    <div
      ref={setNodeRef}
      className={`glass rounded-3xl p-4 space-y-4 min-h-[520px] transition ${
        isOver ? 'ring-2 ring-accent/60' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          {title}
        </h3>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      <SortableContext items={items} strategy={rectSortingStrategy}>
        <div className="space-y-4">{children}</div>
      </SortableContext>
    </div>
  )
}

type CompanyLogoProps = {
  name: string
  logo?: string
}

const CompanyLogo = ({ name, logo }: CompanyLogoProps) => {
  const [hasError, setHasError] = useState(false)

  if (!logo || hasError) {
    return (
      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-sm font-semibold">
        {getInitials(name)}
      </div>
    )
  }

  return (
    <img
      src={logo}
      alt={name}
      className="w-12 h-12 rounded-2xl object-cover"
      onError={() => setHasError(true)}
    />
  )
}

function App() {
  const [rawJobs, setRawJobs] = useState<RawJob[]>(() => {
    const stored = localStorage.getItem(RAW_JOBS_STORAGE_KEY)
    if (!stored) return MOCK_RAW_JOBS
    try {
      return JSON.parse(stored) as RawJob[]
    } catch {
      return MOCK_RAW_JOBS
    }
  })
  const [trackerState, setTrackerState] = useState<TrackerState>(() =>
    loadTrackerState(),
  )
  const [activeView, setActiveView] = useState<
    'overview' | 'discover' | 'kanban' | 'insights'
  >('overview')
  const [userProfile, setUserProfile] = useState<UserProfile>({
    skills: USER_SKILLS,
    experienceYears: null,
    source: 'default',
  })
  const [searchValue, setSearchValue] = useState('')
  const [workTypeFilter, setWorkTypeFilter] = useState<'All' | Job['workType']>(
    'All',
  )
  const [locationFilter, setLocationFilter] = useState<string>('All')
  const [seniorityFilter, setSeniorityFilter] = useState<'All' | Job['seniority']>(
    'All',
  )
  const [sortBy, setSortBy] = useState<'match' | 'date'>('match')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [devToolsOpen, setDevToolsOpen] = useState(false)
  const [devPayload, setDevPayload] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [feedStatus, setFeedStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    'idle',
  )
  const [feedMeta, setFeedMeta] = useState<{
    generatedAt?: string
    source?: string
  }>({})
  const [resumeStatus, setResumeStatus] = useState<
    'idle' | 'parsing' | 'success' | 'error'
  >('idle')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  useEffect(() => {
    persistTrackerState(trackerState)
  }, [trackerState])

  useEffect(() => {
    localStorage.setItem(RAW_JOBS_STORAGE_KEY, JSON.stringify(rawJobs))
  }, [rawJobs])

  useEffect(() => {
    let isMounted = true

    const loadDailyFeed = async () => {
      setFeedStatus('loading')
      try {
        const response = await fetch(FEED_ENDPOINT, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Feed request failed: ${response.status}`)
        }

        const payload = (await response.json()) as unknown
        const parsed = parseFeedPayload(payload)
        if (!parsed.jobs || parsed.jobs.length === 0) {
          throw new Error('Feed payload has no jobs')
        }

        if (!isMounted) return
        setRawJobs(parsed.jobs)
        setFeedMeta({
          generatedAt: parsed.generatedAt,
          source: parsed.source,
        })
        setFeedStatus('loaded')
      } catch {
        if (!isMounted) return
        setFeedStatus('error')
      }
    }

    void loadDailyFeed()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedJob) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedJob(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedJob])

  const jobs = useMemo(
    () => rawJobs.map((raw, index) => normalizeJob(raw, index, userProfile.skills)),
    [rawJobs, userProfile.skills],
  )
  const debouncedSearch = useDebouncedValue(searchValue, 250)

  const availableLocations = useMemo(() => {
    const unique = new Set<string>()
    jobs.forEach((job) => unique.add(job.location))
    return ['All', 'India', ...Array.from(unique).sort((a, b) => a.localeCompare(b))]
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    return jobs
      .filter((job) => {
        if (!passesGeoPolicyUi(job)) return false
        if (workTypeFilter !== 'All' && job.workType !== workTypeFilter) return false
        if (locationFilter !== 'All') {
          const matchesLocation =
            locationFilter === 'India'
              ? isIndiaLocation(job.location)
              : job.location === locationFilter
          if (!matchesLocation) return false
        }
        if (seniorityFilter !== 'All' && job.seniority !== seniorityFilter) return false
        if (!query) return true
        return (
          job.title.toLowerCase().includes(query) ||
          job.company.toLowerCase().includes(query)
        )
      })
      .sort((a, b) => {
        if (sortBy === 'match') return b.matchScore - a.matchScore
        const dateA = new Date(a.postedAt).getTime()
        const dateB = new Date(b.postedAt).getTime()
        return dateB - dateA
      })
  }, [jobs, debouncedSearch, workTypeFilter, locationFilter, seniorityFilter, sortBy])

  const topMatches = useMemo(
    () => [...filteredJobs].sort((a, b) => b.matchScore - a.matchScore).slice(0, 3),
    [filteredJobs],
  )

  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0]
    filteredJobs.forEach((job) => {
      if (job.matchScore >= 76) buckets[3] += 1
      else if (job.matchScore >= 51) buckets[2] += 1
      else if (job.matchScore >= 26) buckets[1] += 1
      else buckets[0] += 1
    })
    return buckets
  }, [filteredJobs])

  const trackerJobs = useMemo(() => {
    const allIds = new Set(Object.values(trackerState.columns).flat())
    return jobs.filter((job) => allIds.has(job.id))
  }, [jobs, trackerState.columns])

  const overviewStats = useMemo(() => {
    const tracked = Object.values(trackerState.columns).flat().length
    const applied = trackerState.columns.applied.length
    const interviewing = trackerState.columns.interviewing.length
    const offers = trackerState.columns.offer.length
    const avgMatch =
      filteredJobs.length > 0
        ? Math.round(
            filteredJobs.reduce((sum, job) => sum + job.matchScore, 0) /
              filteredJobs.length,
          )
        : 0

    return { tracked, applied, interviewing, offers, avgMatch }
  }, [trackerState.columns, filteredJobs])

  const insightsStats = useMemo(() => {
    const skillFrequency: Record<string, number> = {}
    jobs.forEach((job) => {
      job.techStack.forEach((skill) => {
        skillFrequency[skill] = (skillFrequency[skill] ?? 0) + 1
      })
    })

    const topSkills = Object.entries(skillFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    return {
      topSkills,
      remoteCount: jobs.filter((job) => job.workType === 'Remote').length,
      hybridCount: jobs.filter((job) => job.workType === 'Hybrid').length,
      onsiteCount: jobs.filter((job) => job.workType === 'Onsite').length,
    }
  }, [jobs])

  const handleResumeUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setResumeStatus('error')
      return
    }

    setResumeStatus('parsing')

    try {
      const bytes = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: bytes })
      const pdf = await loadingTask.promise
      let text = ''

      for (let page = 1; page <= pdf.numPages; page += 1) {
        const content = await (await pdf.getPage(page)).getTextContent()
        const pageText = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
        text += ` ${pageText}`
      }

      const extractedSkills = extractResumeSkills(text)
      const years = extractResumeExperienceYears(text)

      setUserProfile({
        skills: extractedSkills.length > 0 ? extractedSkills : USER_SKILLS,
        experienceYears: years,
        source: 'resume',
        resumeFileName: file.name,
      })
      setResumeStatus('success')
    } catch {
      setResumeStatus('error')
    }
  }

  const addToTracker = (jobId: string) => {
    setTrackerState((prev) => {
      if (prev.columns.saved.includes(jobId)) return prev
      const alreadyTracked = Object.values(prev.columns).some((column) =>
        column.includes(jobId),
      )
      if (alreadyTracked) return prev
      return {
        ...prev,
        columns: {
          ...prev.columns,
          saved: [jobId, ...prev.columns.saved],
        },
      }
    })
  }

  const updateNote = (jobId: string, value: string) => {
    setTrackerState((prev) => ({
      ...prev,
      notes: {
        ...prev.notes,
        [jobId]: value,
      },
    }))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId === overId) return

    const activeColumn = columnOrder.find((column) =>
      trackerState.columns[column].includes(activeId),
    )
    const overColumn = columnOrder.find((column) =>
      trackerState.columns[column].includes(overId),
    )

    if (!activeColumn) return
    const destination = overColumn ?? (columnOrder.includes(overId as ColumnId) ? (overId as ColumnId) : null)

    if (!destination || activeColumn === destination) return

    setTrackerState((prev) => {
      const nextSource = prev.columns[activeColumn].filter((id) => id !== activeId)
      const nextTarget = [...prev.columns[destination], activeId]
      const appliedAt = { ...prev.appliedAt }
      if (destination === 'applied' && !appliedAt[activeId]) {
        appliedAt[activeId] = new Date().toISOString()
      }

      return {
        ...prev,
        columns: {
          ...prev.columns,
          [activeColumn]: nextSource,
          [destination]: nextTarget,
        },
        appliedAt,
      }
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    const sourceColumn = columnOrder.find((column) =>
      trackerState.columns[column].includes(activeId),
    )
    const targetColumn = columnOrder.find((column) =>
      trackerState.columns[column].includes(overId),
    )

    if (!sourceColumn) return
    if (!targetColumn || sourceColumn !== targetColumn) return

    const sourceItems = trackerState.columns[sourceColumn]
    const oldIndex = sourceItems.indexOf(activeId)
    const newIndex = sourceItems.indexOf(overId)
    if (oldIndex === newIndex) return

    setTrackerState((prev) => ({
      ...prev,
      columns: {
        ...prev.columns,
        [sourceColumn]: arrayMove(prev.columns[sourceColumn], oldIndex, newIndex),
      },
    }))
  }

  const handleDevSubmit = () => {
    try {
      const parsed = JSON.parse(devPayload)
      if (!Array.isArray(parsed)) return
      setRawJobs(parsed)
      setFeedMeta({
        generatedAt: new Date().toISOString(),
        source: 'manual-dev-tools',
      })
      setFeedStatus('loaded')
      setDevPayload('')
      setDevToolsOpen(false)
    } catch {
      // ignore invalid JSON
    }
  }

  const jobIdsInTracker = new Set(Object.values(trackerState.columns).flat())

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="absolute inset-0 -z-10 bg-radial-spot bg-mesh-dark" />
      <div className="flex">
        <aside className="hidden lg:flex w-64 flex-col gap-6 px-6 py-8 border-r border-white/10">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Command Center</p>
            <h2 className="text-lg font-semibold text-white">Job Board OS</h2>
          </div>
          <nav className="space-y-2 text-sm">
            {[
              { label: 'Overview', key: 'overview', active: activeView === 'overview' },
              { label: 'Discovery', active: activeView === 'discover' },
              { label: 'Tracker', active: activeView === 'kanban' },
              { label: 'Insights', key: 'insights', active: activeView === 'insights' },
            ].map((item) => (
              <button
                key={item.label}
                className={`w-full text-left px-4 py-2 rounded-xl transition ${
                  item.active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5'
                }`}
                onClick={() => {
                  if (item.label === 'Overview') setActiveView('overview')
                  if (item.label === 'Discovery') setActiveView('discover')
                  if (item.label === 'Tracker') setActiveView('kanban')
                  if (item.label === 'Insights') setActiveView('insights')
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto glass rounded-2xl p-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Status</p>
            <p className="text-sm text-slate-200">
              {trackerJobs.length} roles tracked, {jobs.length} in feed
            </p>
            <p className="text-xs text-slate-400">
              Feed status: {feedStatus}
              {feedMeta.source ? ` | ${feedMeta.source}` : ''}
            </p>
            <p className="text-xs text-slate-400">
              Feed updated: {feedMeta.generatedAt ? formatDate(feedMeta.generatedAt) : 'unknown'}
            </p>
            <div className="text-xs text-slate-400">Updated {new Date().toLocaleDateString('en-US')}</div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="px-6 lg:px-10 py-6 flex flex-col gap-6 border-b border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Job Hunt Command Center</p>
                <h1 className="text-3xl lg:text-4xl font-semibold text-white text-shadow">
                  Hyper-personalized job discovery + pipeline control
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className={`px-4 py-2 rounded-full border border-white/10 text-sm transition ${
                    activeView === 'overview'
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                  onClick={() => setActiveView('overview')}
                >
                  Overview
                </button>
                <button
                  className={`px-4 py-2 rounded-full border border-white/10 text-sm transition ${
                    activeView === 'discover'
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                  onClick={() => setActiveView('discover')}
                >
                  Discovery Feed
                </button>
                <button
                  className={`px-4 py-2 rounded-full border border-white/10 text-sm transition ${
                    activeView === 'kanban'
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                  onClick={() => setActiveView('kanban')}
                >
                  Kanban Tracker
                </button>
                <button
                  className={`px-4 py-2 rounded-full border border-white/10 text-sm transition ${
                    activeView === 'insights'
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                  onClick={() => setActiveView('insights')}
                >
                  Insights
                </button>
              </div>
            </div>
            <div className="glass rounded-2xl p-4 flex flex-wrap items-end gap-3">
              <label className="flex-1 min-w-[240px] block space-y-1">
                <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500 opacity-0">Search Roles</span>
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search by title or company"
                  className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
                />
              </label>
              <div className="flex flex-wrap items-end gap-3">
                <label className="space-y-1">
                  <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Job Type Filter</span>
                  <select
                    value={workTypeFilter}
                    onChange={(event) => setWorkTypeFilter(event.target.value as Job['workType'] | 'All')}
                    className="rounded-xl bg-slate-900/70 border border-white/10 px-3 py-2 text-sm text-slate-200"
                  >
                    <option>All</option>
                    <option>Remote</option>
                    <option>Hybrid</option>
                    <option>Onsite</option>
                    <option>Unknown</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Location Filter</span>
                  <select
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                    className="rounded-xl bg-slate-900/70 border border-white/10 px-3 py-2 text-sm text-slate-200 max-w-[220px]"
                  >
                    {availableLocations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Job Level Filter</span>
                  <select
                    value={seniorityFilter}
                    onChange={(event) => setSeniorityFilter(event.target.value as Job['seniority'] | 'All')}
                    className="rounded-xl bg-slate-900/70 border border-white/10 px-3 py-2 text-sm text-slate-200"
                  >
                    <option>All</option>
                    <option>Entry</option>
                    <option>Mid</option>
                    <option>Senior</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">Sort</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as 'match' | 'date')}
                    className="rounded-xl bg-slate-900/70 border border-white/10 px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="match">Match Score</option>
                    <option value="date">Date</option>
                  </select>
                </label>
                <div className="flex rounded-xl border border-white/10 overflow-hidden">
                  <button
                    className={`px-3 py-2 text-xs ${
                      viewMode === 'grid' ? 'bg-accent text-white' : 'bg-white/5'
                    }`}
                    onClick={() => setViewMode('grid')}
                  >
                    Grid
                  </button>
                  <button
                    className={`px-3 py-2 text-xs ${
                      viewMode === 'list' ? 'bg-accent text-white' : 'bg-white/5'
                    }`}
                    onClick={() => setViewMode('list')}
                  >
                    List
                  </button>
                </div>
                <button
                  className={`text-xs px-3 py-2 rounded-xl border transition flex items-center gap-2 ${
                    devToolsOpen
                      ? 'border-accent/60 bg-accent/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                  onClick={() => setDevToolsOpen((prev) => !prev)}
                >
                  <span>Dev Tools</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10">
                    {devToolsOpen ? 'On' : 'Off'}
                  </span>
                </button>
              </div>
            </div>
            <div className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Profile Source</p>
                <p className="text-sm text-slate-200">
                  {userProfile.source === 'resume'
                    ? `Resume parsed: ${userProfile.resumeFileName ?? 'uploaded file'}`
                    : 'Using default profile skills'}
                </p>
                <p className="text-xs text-slate-400">
                  Skills detected: {userProfile.skills.length}
                  {userProfile.experienceYears !== null
                    ? ` | Experience: ${userProfile.experienceYears}+ years`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm cursor-pointer hover:bg-white/10">
                  Upload Resume PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleResumeUpload}
                  />
                </label>
                <span className="text-xs text-slate-400">
                  {resumeStatus === 'parsing' && 'Parsing resume...'}
                  {resumeStatus === 'success' && 'Resume profile applied'}
                  {resumeStatus === 'error' && 'Resume parsing failed'}
                  {resumeStatus === 'idle' && 'No resume uploaded'}
                </span>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {devToolsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Paste Apify JSON array</p>
                    <button
                      className="text-xs text-slate-300 hover:text-white"
                      onClick={() => setDevToolsOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                  <textarea
                    value={devPayload}
                    onChange={(event) => setDevPayload(event.target.value)}
                    rows={6}
                    placeholder="[ { ... }, { ... } ]"
                    className="w-full rounded-xl bg-slate-900/70 border border-white/10 px-4 py-3 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent/60"
                  />
                  <button
                    className="px-4 py-2 rounded-xl bg-accent text-white text-sm"
                    onClick={handleDevSubmit}
                  >
                    Update Jobs
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </header>

          <main className="px-6 lg:px-10 py-8 space-y-10">
        {activeView === 'overview' && (
          <section className="space-y-6">
            <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
              {[
                { label: 'Tracked Jobs', value: overviewStats.tracked },
                { label: 'Applied', value: overviewStats.applied },
                { label: 'Interviewing', value: overviewStats.interviewing },
                { label: 'Offers', value: overviewStats.offers },
                { label: 'Avg Match', value: `${overviewStats.avgMatch}%` },
              ].map((item) => (
                <div key={item.label} className="glass rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                  <p className="text-2xl font-semibold text-white mt-1">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid xl:grid-cols-2 gap-6">
              <div className="glass rounded-3xl p-6 space-y-4">
                <h2 className="text-xl font-semibold">Priority Queue</h2>
                <p className="text-sm text-slate-400">
                  Highest match roles after current filters and profile.
                </p>
                <div className="space-y-3">
                  {filteredJobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="rounded-2xl bg-white/5 p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-400">{job.company}</p>
                        <p className="text-lg font-semibold text-white">{job.title}</p>
                        <p className="text-xs text-slate-400">{job.location}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${matchScoreColor(job.matchScore)} text-slate-900`}>
                        {job.matchScore}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass rounded-3xl p-6 space-y-4">
                <h2 className="text-xl font-semibold">Workflow Guidance</h2>
                <div className="space-y-4 text-sm text-slate-300">
                  <p>1. Upload your resume to personalize ranking and skill matching.</p>
                  <p>2. Use Location + Work Type filters to narrow the discovery pool quickly.</p>
                  <p>3. Save only high-confidence roles to keep Kanban focused and actionable.</p>
                  <p>4. Keep notes in cards so interviews and follow-ups stay centralized.</p>
                </div>
                <div className="rounded-2xl bg-indigo-500/15 border border-indigo-400/30 p-4 text-sm text-indigo-100">
                  Current profile source: {userProfile.source === 'resume' ? 'Resume-driven' : 'Default skills'}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeView === 'discover' && (
          <>
            <section className="grid lg:grid-cols-[2fr_1fr] gap-6">
              <div className="glass rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Top Matches</h2>
                  <span className="text-xs text-slate-400">
                    {filteredJobs.length} results after filters
                  </span>
                </div>
                <div className="grid gap-4">
                  {topMatches.map((job) => (
                    <div key={job.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/5">
                      <div>
                        <p className="text-sm text-slate-400">{job.company}</p>
                        <p className="text-lg font-semibold text-white">{job.title}</p>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${matchScoreColor(job.matchScore)} text-slate-900`}>
                          {job.matchScore}%
                        </div>
                        <p className="text-xs text-slate-400">{job.workType}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass rounded-3xl p-6 space-y-4">
                <h2 className="text-xl font-semibold">Match Score Distribution</h2>
                <div className="space-y-3">
                  {['0-25', '26-50', '51-75', '76-100'].map((label, index) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{label}</span>
                        <span>{distribution[index]}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                          style={{
                              width: `${Math.min(100, (distribution[index] / Math.max(1, filteredJobs.length)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              className={
                viewMode === 'grid'
                  ? 'grid sm:grid-cols-2 xl:grid-cols-3 gap-6'
                  : 'space-y-4'
              }
            >
              {filteredJobs.map((job) =>
                viewMode === 'grid' ? (
                  <motion.div
                    key={job.id}
                    whileHover={{ y: -6 }}
                    className="glass rounded-3xl p-5 space-y-4 border border-white/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                          <CompanyLogo name={job.company} logo={job.logo} />
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            {job.company}
                          </p>
                          <h3 className="text-lg font-semibold text-white">{job.title}</h3>
                          <p className="text-xs text-slate-400">{job.location}</p>
                        </div>
                      </div>
                      <div className={`text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r ${matchScoreColor(job.matchScore)} text-slate-900`}>
                        {job.matchScore}%
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-full bg-white/10 text-slate-200">{job.workType}</span>
                      <span className="px-2 py-1 rounded-full bg-white/10 text-slate-200">{job.seniority}</span>
                      <span className="px-2 py-1 rounded-full bg-white/10 text-slate-200">{job.experience}</span>
                      <span className="px-2 py-1 rounded-full bg-white/10 text-slate-200">Posted {formatDate(job.postedAt)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(job.techStack.length ? job.techStack : ['Not specified']).map((skill) => (
                        <span
                          key={`${job.id}-${skill}`}
                          className={`text-xs px-2 py-1 rounded-full ${
                            job.matchedSkills.includes(skill.toLowerCase())
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : 'bg-rose-500/20 text-rose-200'
                          }`}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="px-4 py-2 rounded-xl bg-accent text-white text-sm"
                        onClick={() => addToTracker(job.id)}
                        disabled={jobIdsInTracker.has(job.id)}
                      >
                        {jobIdsInTracker.has(job.id) ? 'Already Tracked' : 'Save to Tracker'}
                      </button>
                      <button
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200"
                        onClick={() => setSelectedJob(job)}
                      >
                        View Details
                      </button>
                      <a
                        href={job.applyLink || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className={`px-4 py-2 rounded-xl text-sm ${
                          job.applyLink
                            ? 'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10'
                            : 'bg-white/5 text-slate-500 cursor-not-allowed'
                        }`}
                        onClick={(event) => {
                          if (!job.applyLink) event.preventDefault()
                        }}
                      >
                        Apply Link
                      </a>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={job.id}
                    whileHover={{ y: -2 }}
                    className="glass rounded-3xl p-5 border border-white/10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"
                  >
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <CompanyLogo name={job.company} logo={job.logo} />
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            {job.company}
                          </p>
                          <h3 className="text-lg font-semibold text-white">{job.title}</h3>
                          <p className="text-xs text-slate-400">{job.location}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-white/10 text-slate-200">{job.workType}</span>
                        <span className="px-2 py-1 rounded-full bg-white/10 text-slate-200">{job.seniority}</span>
                        <span className="px-2 py-1 rounded-full bg-white/10 text-slate-200">{job.experience}</span>
                        <span className="px-2 py-1 rounded-full bg-white/10 text-slate-200">Posted {formatDate(job.postedAt)}</span>
                      </div>
                    </div>
                    <div className="lg:w-[320px] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className={`text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r ${matchScoreColor(job.matchScore)} text-slate-900`}>
                          {job.matchScore}%
                        </div>
                        <button
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200"
                          onClick={() => setSelectedJob(job)}
                        >
                          View Details
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(job.techStack.length ? job.techStack : ['Not specified']).map((skill) => (
                          <span
                            key={`${job.id}-${skill}`}
                            className={`text-xs px-2 py-1 rounded-full ${
                              job.matchedSkills.includes(skill.toLowerCase())
                                ? 'bg-emerald-500/20 text-emerald-200'
                                : 'bg-rose-500/20 text-rose-200'
                            }`}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs"
                          onClick={() => addToTracker(job.id)}
                          disabled={jobIdsInTracker.has(job.id)}
                        >
                          {jobIdsInTracker.has(job.id) ? 'Already Tracked' : 'Save to Tracker'}
                        </button>
                        <a
                          href={job.applyLink || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className={`px-3 py-1.5 rounded-lg text-xs ${
                            job.applyLink
                              ? 'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10'
                              : 'bg-white/5 text-slate-500 cursor-not-allowed'
                          }`}
                          onClick={(event) => {
                            if (!job.applyLink) event.preventDefault()
                          }}
                        >
                          Apply Link
                        </a>
                      </div>
                    </div>
                  </motion.div>
                ),
              )}
              {filteredJobs.length === 0 && (
                <div className="glass rounded-3xl border border-white/10 p-8 text-center text-slate-300">
                  No jobs match the selected filters. Try changing job type, location, or search text.
                </div>
              )}
            </section>
          </>
        )}

        {activeView === 'kanban' && (
          <section className="space-y-6">
            <div className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Pipeline Overview</p>
                <h2 className="text-2xl font-semibold text-white">Application Tracker</h2>
              </div>
              <p className="text-xs text-slate-400">
                {trackerJobs.length} tracked roles
              </p>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid xl:grid-cols-5 gap-4">
                {columnOrder.map((columnId) => {
                  const items = trackerState.columns[columnId]
                  return (
                    <KanbanColumn
                      key={columnId}
                      columnId={columnId}
                      title={ColumnTitle[columnId]}
                      count={items.length}
                      items={items}
                    >
                      {items.map((jobId) => {
                        const job = trackerJobs.find((item) => item.id === jobId)
                        if (!job) return null
                        const note = trackerState.notes[job.id] ?? ''
                        const appliedLabel =
                          columnId === 'applied' || columnId === 'interviewing' || columnId === 'offer'
                            ? daysAgo(trackerState.appliedAt[job.id])
                            : null
                        return (
                          <SortableCard
                            key={job.id}
                            job={job}
                            note={note}
                            badgeColor={matchScoreColor(job.matchScore)}
                            appliedLabel={appliedLabel}
                            onNoteChange={(value) => updateNote(job.id, value)}
                          />
                        )
                      })}
                    </KanbanColumn>
                  )
                })}
              </div>
            </DndContext>
          </section>
        )}

        {activeView === 'insights' && (
          <section className="space-y-6">
            <div className="glass rounded-3xl p-6 space-y-4">
              <h2 className="text-2xl font-semibold text-white">Market Insights</h2>
              <p className="text-sm text-slate-400">
                Demand and channel health from the currently loaded jobs dataset.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Remote</p>
                  <p className="text-2xl font-semibold text-white">{insightsStats.remoteCount}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Hybrid</p>
                  <p className="text-2xl font-semibold text-white">{insightsStats.hybridCount}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Onsite</p>
                  <p className="text-2xl font-semibold text-white">{insightsStats.onsiteCount}</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-3xl p-6 space-y-4">
              <h3 className="text-xl font-semibold">Top Mentioned Skills</h3>
              <div className="space-y-3">
                {insightsStats.topSkills.map(([skill, count]) => (
                  <div key={skill} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{skill}</span>
                      <span>{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
                        style={{
                          width: `${Math.min(100, (count / Math.max(1, insightsStats.topSkills[0]?.[1] ?? 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {selectedJob && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4 py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedJob(null)}
          >
            <motion.div
              className="glass max-w-3xl w-full max-h-[88vh] overflow-hidden rounded-3xl p-6 flex flex-col"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 -mx-6 px-6 pb-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{selectedJob.company}</p>
                    <h2 className="text-2xl font-semibold text-white">{selectedJob.title}</h2>
                    <p className="text-xs text-slate-400">{selectedJob.location}</p>
                  </div>
                  <button
                    className="text-xs px-3 py-1 rounded-full bg-white/5"
                    onClick={() => setSelectedJob(null)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar space-y-4 py-4 pr-1">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-white/10">{selectedJob.workType}</span>
                  <span className="px-2 py-1 rounded-full bg-white/10">{selectedJob.seniority}</span>
                  <span className="px-2 py-1 rounded-full bg-white/10">{selectedJob.experience}</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 max-h-[36vh] overflow-y-auto thin-scrollbar">
                  <p className="text-sm text-slate-200 leading-7 whitespace-pre-line break-words">
                    {selectedJob.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.techStack.length ? (
                    selectedJob.techStack.map((skill) => (
                      <span key={`${selectedJob.id}-${skill}`} className="px-2 py-1 rounded-full bg-white/10 text-xs text-slate-200">
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-slate-200">Not specified</span>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 z-10 -mx-6 px-6 pt-4 border-t border-white/10 bg-slate-900/80 backdrop-blur-md">
                <div className="flex flex-wrap gap-3">
                  <button
                    className="px-4 py-2 rounded-xl bg-accent text-white text-sm"
                    onClick={() => addToTracker(selectedJob.id)}
                  >
                    Save to Tracker
                  </button>
                  <a
                    href={selectedJob.applyLink || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className={`px-4 py-2 rounded-xl text-sm ${
                      selectedJob.applyLink
                        ? 'bg-white/5 border border-white/10 text-slate-200'
                        : 'bg-white/5 text-slate-500 cursor-not-allowed'
                    }`}
                    onClick={(event) => {
                      if (!selectedJob.applyLink) event.preventDefault()
                    }}
                  >
                    Apply Link
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
