import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ApifyClient } from 'apify-client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const domainsPath = path.join(rootDir, 'scripts', 'domains.json')
const outputPath = path.join(rootDir, 'public', 'data', 'jobs.json')
const apifyToken = process.env.APIFY_TOKEN ?? ''
const apifyActorId = process.env.APIFY_ACTOR_ID ?? ''
const apifyClient = apifyToken ? new ApifyClient({ token: apifyToken }) : null

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

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

const REMOTE_HINTS = ['remote', 'work from home', 'wfh', 'anywhere', 'worldwide']

const safeDate = (value) => {
  if (typeof value === 'number') {
    const normalized = value < 1_000_000_000_000 ? value * 1000 : value
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const numericValue = Number(value)
    const normalized = numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const normalizeText = (value) => String(value ?? '').toLowerCase()

const includesAnyHint = (text, hints) => {
  const normalized = normalizeText(text)
  return hints.some((hint) => normalized.includes(hint))
}

const isIndiaJob = (job) => includesAnyHint(job.location, INDIA_LOCATION_HINTS)

const isOnsiteJob = (job) => {
  const workplaceType = normalizeText(job.workplaceType)
  if (workplaceType.includes('onsite') || workplaceType.includes('on-site')) return true
  if (workplaceType.includes('remote') || workplaceType.includes('hybrid')) return false

  return includesAnyHint(`${job.title ?? ''} ${job.location ?? ''}`, ['onsite', 'on-site', 'in office'])
}

const isRemoteJob = (job) => {
  const workplaceType = normalizeText(job.workplaceType)
  if (workplaceType.includes('onsite') || workplaceType.includes('on-site')) return false
  if (workplaceType.includes('hybrid')) return false
  if (workplaceType.includes('remote')) return true

  return includesAnyHint(
    `${job.title ?? ''} ${job.location ?? ''}`,
    REMOTE_HINTS,
  )
}

const passesGeoPolicy = (job) => {
  if (isIndiaJob(job)) return true
  return isRemoteJob(job)
}

const toArray = (value) => (Array.isArray(value) ? value : [])

const ensureUniqueStrings = (values) =>
  Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)))

const normalizeDomain = (value) => {
  if (typeof value === 'string') {
    return {
      name: value,
      synonyms: [],
      boostSkills: [],
    }
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const name = String(value.name ?? '').trim()
  if (!name) return null

  return {
    name,
    synonyms: ensureUniqueStrings(toArray(value.synonyms)),
    boostSkills: ensureUniqueStrings(toArray(value.boostSkills)),
  }
}

const getDomainTerms = (domain) => [domain.name, ...domain.synonyms]

const scoreDomainMatch = (text, domain) => {
  const terms = getDomainTerms(domain).map((term) => term.toLowerCase())
  let score = 0

  for (const term of terms) {
    if (!term) continue
    if (text.includes(term)) {
      score += term === domain.name.toLowerCase() ? 55 : 40
    }
  }

  for (const skill of domain.boostSkills.map((entry) => entry.toLowerCase())) {
    if (!skill) continue
    if (text.includes(skill)) {
      score += 10
    }
  }

  return score
}

const findBestDomain = (text, domains) => {
  let bestDomain = null
  let bestScore = 0

  for (const domain of domains) {
    const score = scoreDomainMatch(text, domain)
    if (score > bestScore) {
      bestScore = score
      bestDomain = domain
    }
  }

  return { bestDomain, bestScore }
}

const computeBoostScore = (job, domains) => {
  const haystack = normalizeText(
    `${job.title ?? ''} ${job.description ?? ''} ${job.location ?? ''} ${job.companyName ?? ''}`,
  )
  const { bestDomain, bestScore } = findBestDomain(haystack, domains)

  return {
    matchedDomain: bestDomain ? bestDomain.name : null,
    boostScore: bestScore,
  }
}

const parseConfig = async () => {
  const raw = await fs.readFile(domainsPath, 'utf8')
  const parsed = JSON.parse(raw)

  const normalizedDomains = toArray(parsed.domains)
    .map((entry) => normalizeDomain(entry))
    .filter(Boolean)

  return {
    domains: normalizedDomains,
    lastHours: Number(parsed.lastHours) > 0 ? Number(parsed.lastHours) : 24,
    maxJobs: Number(parsed.maxJobs) > 0 ? Number(parsed.maxJobs) : 150,
  }
}

const mapRemotiveJob = (job, domain) => ({
  id: `remotive-${job.id}`,
  title: job.title ?? 'Unknown Role',
  companyName: job.company_name ?? 'Unknown Company',
  companyLogo: job.company_logo ?? '',
  location: job.candidate_required_location ?? 'Unknown',
  workplaceType: 'remote',
  description: job.description ?? '',
  jobPostingUrl: job.url ?? '',
  postedAt: job.publication_date ?? new Date().toISOString(),
  source: 'remotive',
  domain,
})

const mapArbeitnowJob = (job, domain) => ({
  id: `arbeitnow-${job.slug ?? slugify(job.title ?? 'job')}`,
  title: job.title ?? 'Unknown Role',
  companyName: job.company_name ?? 'Unknown Company',
  companyLogo: '',
  location: job.location ?? 'Unknown',
  workplaceType: job.remote ? 'remote' : 'onsite',
  description: job.description ?? '',
  jobPostingUrl: job.url ?? '',
  postedAt: job.created_at ?? new Date().toISOString(),
  source: 'arbeitnow',
  domain,
})

const mapApifyJob = (job, domain, index) => ({
  id: `apify-${job.id ?? slugify(job.url ?? job.jobUrl ?? `${domain}-${index}`)}`,
  title: job.title ?? job.positionName ?? job.position ?? 'Unknown Role',
  companyName: job.companyName ?? job.company ?? job.company_name ?? 'Unknown Company',
  companyLogo: job.companyLogo ?? job.company_logo ?? '',
  location: job.location ?? job.jobLocation ?? 'Unknown',
  workplaceType: job.workplaceType ?? (job.isRemote ? 'remote' : 'onsite'),
  description: job.description ?? job.jobDescription ?? '',
  jobPostingUrl: job.url ?? job.jobUrl ?? job.link ?? '',
  postedAt: job.postedAt ?? job.publication_date ?? job.date ?? new Date().toISOString(),
  source: 'apify',
  domain,
})

const fetchRemotiveJobs = async (domainName) => {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(domainName)}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Remotive request failed for ${domainName}: ${response.status}`)
  }
  const data = await response.json()
  const jobs = Array.isArray(data.jobs) ? data.jobs : []
  return jobs.map((job) => mapRemotiveJob(job, domainName))
}

const fetchArbeitnowJobs = async (domains) => {
  const maxPages = 6
  const collected = []

  for (let page = 1; page <= maxPages; page += 1) {
    const url = `https://www.arbeitnow.com/api/job-board-api?page=${page}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Arbeitnow request failed on page ${page}: ${response.status}`)
    }

    const data = await response.json()
    const jobs = Array.isArray(data.data) ? data.data : []
    if (jobs.length === 0) break
    collected.push(...jobs)
  }

  const loweredDomains = domains.map((domain) => ({
    domain,
    terms: getDomainTerms(domain).map((term) => term.toLowerCase()),
  }))

  return collected
    .flatMap((job) => {
      const haystack = `${job.title ?? ''} ${job.description ?? ''}`.toLowerCase()
      const matched = loweredDomains.find((entry) =>
        entry.terms.some((term) => term && haystack.includes(term)),
      )
      if (!matched) return []
      return [mapArbeitnowJob(job, matched.domain.name)]
    })
}

const fetchApifyJobsForDomain = async (domainName, maxPerDomain) => {
  if (!apifyClient || !apifyActorId) {
    return []
  }

  const actorInput = {
    query: domainName,
    searchTerms: domainName,
    title: domainName,
    maxItems: maxPerDomain,
    limit: maxPerDomain,
  }

  const run = await apifyClient.actor(apifyActorId).call(actorInput)
  const datasetId = run.defaultDatasetId
  if (!datasetId) return []

  const listResult = await apifyClient.dataset(datasetId).listItems({
    limit: maxPerDomain,
    clean: true,
  })

  const items = Array.isArray(listResult.items) ? listResult.items : []
  return items.map((item, index) => mapApifyJob(item, domainName, index))
}

const run = async () => {
  const config = await parseConfig()

  if (config.domains.length === 0) {
    throw new Error('No valid domains found in scripts/domains.json')
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() - config.lastHours * 60 * 60 * 1000)

  const allResults = []
  const apifyPerDomain = Math.max(1, Math.floor(config.maxJobs / config.domains.length))

  for (const domain of config.domains) {
    const domainName = domain.name

    try {
      const jobs = await fetchRemotiveJobs(domainName)
      allResults.push(...jobs)
      console.log(`Fetched ${jobs.length} jobs from Remotive for domain: ${domainName}`)
    } catch (error) {
      console.error(`Failed Remotive domain ${domainName}:`, error.message)
    }

    if (apifyClient && apifyActorId) {
      try {
        const jobs = await fetchApifyJobsForDomain(domainName, apifyPerDomain)
        allResults.push(...jobs)
        console.log(`Fetched ${jobs.length} jobs from Apify for domain: ${domainName}`)
      } catch (error) {
        console.error(`Failed Apify domain ${domainName}:`, error.message)
      }
    }
  }

  try {
    const jobs = await fetchArbeitnowJobs(config.domains)
    allResults.push(...jobs)
    console.log(`Fetched ${jobs.length} jobs from Arbeitnow across all domains`)
  } catch (error) {
    console.error('Failed Arbeitnow source:', error.message)
  }

  const dedupedMap = new Map()
  for (const job of allResults) {
    const uniqueKey = job.jobPostingUrl || `${job.title}-${job.companyName}`
    const scored = {
      ...job,
      ...computeBoostScore(job, config.domains),
    }

    const existing = dedupedMap.get(uniqueKey)
    if (!existing) {
      dedupedMap.set(uniqueKey, scored)
      continue
    }

    const existingDate = safeDate(existing.postedAt)?.getTime() ?? 0
    const incomingDate = safeDate(scored.postedAt)?.getTime() ?? 0
    const shouldReplace =
      (scored.boostScore ?? 0) > (existing.boostScore ?? 0) ||
      ((scored.boostScore ?? 0) === (existing.boostScore ?? 0) && incomingDate > existingDate)

    if (shouldReplace) {
      dedupedMap.set(uniqueKey, scored)
    }
  }

  const geoFiltered = Array.from(dedupedMap.values()).filter((job) => passesGeoPolicy(job))

  const sorted = geoFiltered.sort((a, b) => {
    const aDate = safeDate(a.postedAt)?.getTime() ?? 0
    const bDate = safeDate(b.postedAt)?.getTime() ?? 0
    const dateDelta = bDate - aDate
    if (dateDelta !== 0) return dateDelta

    const boostDelta = (b.boostScore ?? 0) - (a.boostScore ?? 0)
    if (boostDelta !== 0) return boostDelta

    return 0
  })

  const recentOnly = sorted.filter((job) => {
    const date = safeDate(job.postedAt)
    return date ? date >= cutoff : false
  })

  const selected = (recentOnly.length > 0 ? recentOnly : sorted)
    .slice(0, config.maxJobs)
    .map((job, index) => ({
      ...job,
      id: job.id || `job-${slugify(job.companyName)}-${index}`,
    }))

  const payload = {
    generatedAt: now.toISOString(),
    source: 'daily-multi-source-pipeline',
    config,
    apify: {
      enabled: Boolean(apifyClient && apifyActorId),
      actorId: apifyActorId || null,
    },
    total: selected.length,
    jobs: selected,
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8')

  console.log(
    `Wrote ${selected.length} jobs to ${outputPath} (${recentOnly.length} within last ${config.lastHours}h, ${geoFiltered.length} after India/remote filter)`,
  )
}

run().catch((error) => {
  console.error('Job feed update failed:', error)
  process.exit(1)
})
