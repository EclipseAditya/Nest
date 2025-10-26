'use client'
import { useQuery } from '@apollo/client/react'
import { faFilter, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Pagination } from '@heroui/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { FC, useState, useEffect } from 'react'
import { handleAppError } from 'app/global-error'
import { Ordering } from 'types/__generated__/graphql'
import { GetProjectHealthMetricsDocument } from 'types/__generated__/projectsHealthDashboardQueries.generated'
import { DropDownSectionProps } from 'types/DropDownSectionProps'
import { HealthMetricsProps } from 'types/healthMetrics'
import { getKeysLabels } from 'utils/getKeysLabels'
import LoadingSpinner from 'components/LoadingSpinner'
import MetricsCard from 'components/MetricsCard'
import ProjectsDashboardDropDown from 'components/ProjectsDashboardDropDown'

const PAGINATION_LIMIT = 10

const FIELD_MAPPING: Record<string, string> = {
  score: 'score',
  stars: 'starsCount',
  forks: 'forksCount',
  contributors: 'contributorsCount',
  createdAt: 'createdAt',
}

const parseOrderParam = (orderParam: string | null) => {
  if (!orderParam) {
    return { field: 'score', direction: Ordering.Desc, urlKey: '-score' }
  }

  const isDescending = orderParam.startsWith('-')
  const fieldKey = isDescending ? orderParam.slice(1) : orderParam
  const graphqlField = FIELD_MAPPING[fieldKey] || 'score'
  const direction = isDescending ? Ordering.Desc : Ordering.Asc

  return { field: graphqlField, direction, urlKey: orderParam }
}

const buildGraphQLOrdering = (field: string, direction: Ordering) => {
  return {
    [field]: direction,
  }
}

const buildOrderingWithTieBreaker = (primaryOrdering: Record<string, Ordering>) => [
  primaryOrdering,
  {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    project_Name: Ordering.Asc,
  },
]
const SortableColumnHeader: FC<{
  label: string
  fieldKey: string
  currentOrderKey: string
  onSort: (orderKey: string | null) => void
  align?: 'left' | 'center' | 'right'
}> = ({ label, fieldKey, currentOrderKey, onSort, align = 'left' }) => {
  const isActiveSortDesc = currentOrderKey === `-${fieldKey}`
  const isActiveSortAsc = currentOrderKey === fieldKey
  const isActive = isActiveSortDesc || isActiveSortAsc

  const handleClick = () => {
    if (!isActive) {
      onSort(`-${fieldKey}`)
    } else if (isActiveSortDesc) {
      onSort(fieldKey)
    } else {
      onSort(null)
    }
  }

  const alignmentClass =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
  const textAlignClass =
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'

  return (
    <div className={`flex items-center gap-1 ${alignmentClass}`}>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1 font-semibold transition-colors hover:text-blue-600 ${textAlignClass}`}
        title={`Sort by ${label}`}
      >
        <span className="truncate">{label}</span>
        <FontAwesomeIcon
          icon={isActiveSortDesc ? faSortDown : isActiveSortAsc ? faSortUp : faSort}
          className={`h-3 w-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
        />
      </button>
    </div>
  )
}

const MetricsPage: FC = () => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const healthFiltersMapping = {
    healthy: {
      score: {
        gte: 75,
      },
    },
    needsAttention: {
      score: {
        gte: 50,
        lt: 75,
      },
    },
    unhealthy: {
      score: {
        lt: 50,
      },
    },
  }
  const levelFiltersMapping = {
    incubator: {
      level: 'incubator',
    },
    lab: {
      level: 'lab',
    },
    production: {
      level: 'production',
    },
    flagship: {
      level: 'flagship',
    },
  }

  let currentFilters = {}
  const orderingParam = searchParams.get('order')
  const { field, direction, urlKey } = parseOrderParam(orderingParam)
  const currentOrdering = buildGraphQLOrdering(field, direction)

  const healthFilter = searchParams.get('health')
  const levelFilter = searchParams.get('level')
  const currentFilterKeys = []
  if (healthFilter) {
    currentFilters = {
      ...healthFiltersMapping[healthFilter],
    }
    currentFilterKeys.push(healthFilter)
  }
  if (levelFilter) {
    currentFilters = {
      ...currentFilters,
      ...levelFiltersMapping[levelFilter],
    }
    currentFilterKeys.push(levelFilter)
  }

  const [metrics, setMetrics] = useState<HealthMetricsProps[]>([])
  const [metricsLength, setMetricsLength] = useState<number>(0)
  const [pagination, setPagination] = useState({ offset: 0, limit: PAGINATION_LIMIT })
  const [filters, setFilters] = useState(currentFilters)
  const [ordering, setOrdering] = useState(currentOrdering)
  const [activeFilters, setActiveFilters] = useState(currentFilterKeys)
  const {
    data,
    error: graphQLRequestError,
    loading,
    fetchMore,
  } = useQuery(GetProjectHealthMetricsDocument, {
    variables: {
      filters,
      pagination: { offset: 0, limit: PAGINATION_LIMIT },
      ordering: buildOrderingWithTieBreaker(ordering),
    },
  })

  useEffect(() => {
    if (data) {
      setMetrics(data.projectHealthMetrics)
      setMetricsLength(data.projectHealthMetricsDistinctLength)
    }
    if (graphQLRequestError) {
      handleAppError(graphQLRequestError)
    }
  }, [data, graphQLRequestError])

  const filteringSections: DropDownSectionProps[] = [
    {
      title: 'Project Level',
      items: [
        { label: 'Incubator', key: 'incubator' },
        { label: 'Lab', key: 'lab' },
        { label: 'Production', key: 'production' },
        { label: 'Flagship', key: 'flagship' },
      ],
    },
    {
      title: 'Project Health',
      items: [
        { label: 'Healthy', key: 'healthy' },
        { label: 'Need Attention', key: 'needsAttention' },
        { label: 'Unhealthy', key: 'unhealthy' },
      ],
    },
    {
      title: 'Reset Filters',
      items: [{ label: 'Reset All Filters', key: 'reset' }],
    },
  ]

  const getCurrentPage = () => {
    return Math.floor(pagination.offset / PAGINATION_LIMIT) + 1
  }

  const handleSort = (orderKey: string | null) => {
    setPagination({ offset: 0, limit: PAGINATION_LIMIT })
    const newParams = new URLSearchParams(searchParams.toString())

    if (orderKey === null) {
      newParams.delete('order')
      const defaultOrdering = buildGraphQLOrdering('score', Ordering.Desc)
      setOrdering(defaultOrdering)
    } else {
      newParams.set('order', orderKey)
      const { field: newField, direction: newDirection } = parseOrderParam(orderKey)
      const newOrdering = buildGraphQLOrdering(newField, newDirection)
      setOrdering(newOrdering)
    }

    router.replace(`/projects/dashboard/metrics?${newParams.toString()}`)
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Project Health Metrics</h1>
        <div className="flex flex-row items-center gap-2">
          <ProjectsDashboardDropDown
            buttonDisplayName="Filter By"
            icon={faFilter}
            sections={filteringSections}
            selectionMode="multiple"
            selectedKeys={activeFilters}
            selectedLabels={getKeysLabels(filteringSections, activeFilters)}
            onAction={(key: string) => {
              // Because how apollo caches pagination, we need to reset the pagination.
              setPagination({ offset: 0, limit: PAGINATION_LIMIT })
              let newFilters = { ...currentFilters }
              const newParams = new URLSearchParams(searchParams.toString())
              if (key in healthFiltersMapping) {
                newParams.set('health', key)
                newFilters = { ...newFilters, ...healthFiltersMapping[key] }
              } else if (key in levelFiltersMapping) {
                newParams.set('level', key)
                newFilters = { ...newFilters, ...levelFiltersMapping[key] }
              } else {
                newParams.delete('health')
                newParams.delete('level')
                newFilters = {}
              }
              setFilters(newFilters)
              setActiveFilters(
                Array.from(
                  newParams
                    .entries()
                    .filter(([key]) => key != 'order')
                    .map(([, value]) => value)
                )
              )
              router.replace(`/projects/dashboard/metrics?${newParams.toString()}`)
            }}
          />
        </div>
      </div>
      <div className="grid grid-cols-[4fr_1fr_1fr_1fr_1.5fr_1fr] gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="truncate font-semibold">Project Name</div>
        <SortableColumnHeader
          label="Stars"
          fieldKey="stars"
          currentOrderKey={urlKey}
          onSort={handleSort}
          align="center"
        />
        <SortableColumnHeader
          label="Forks"
          fieldKey="forks"
          currentOrderKey={urlKey}
          onSort={handleSort}
          align="center"
        />
        <SortableColumnHeader
          label="Contributors"
          fieldKey="contributors"
          currentOrderKey={urlKey}
          onSort={handleSort}
          align="center"
        />
        <SortableColumnHeader
          label="Health Checked At"
          fieldKey="createdAt"
          currentOrderKey={urlKey}
          onSort={handleSort}
          align="center"
        />
        <SortableColumnHeader
          label="Score"
          fieldKey="score"
          currentOrderKey={urlKey}
          onSort={handleSort}
          align="center"
        />
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2">
            {metrics.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No metrics found. Try adjusting your filters.
              </div>
            ) : (
              metrics.map((metric) => <MetricsCard key={metric.id} metric={metric} />)
            )}
          </div>
          <div className="mt-4 flex items-center justify-center">
            <Pagination
              initialPage={getCurrentPage()}
              page={getCurrentPage()}
              total={Math.ceil(metricsLength / PAGINATION_LIMIT)}
              onChange={async (page) => {
                const newOffset = (page - 1) * PAGINATION_LIMIT
                const newPagination = { offset: newOffset, limit: PAGINATION_LIMIT }
                setPagination(newPagination)
                await fetchMore({
                  variables: {
                    filters,
                    pagination: newPagination,
                    ordering: buildOrderingWithTieBreaker(ordering),
                  },
                  updateQuery: (prev, { fetchMoreResult }) => {
                    if (!fetchMoreResult) return prev
                    return {
                      ...prev,
                      projectHealthMetrics: fetchMoreResult.projectHealthMetrics,
                    }
                  },
                })
              }}
              showControls
              color="warning"
              className="mt-4"
            />
          </div>
        </>
      )}
    </>
  )
}

export default MetricsPage
