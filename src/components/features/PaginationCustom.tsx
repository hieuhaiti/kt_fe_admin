import React from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

const getPageNumbers = (currentPage: number, totalPages: number) => {
  const pages: (number | '...')[] = []
  const delta = 2
  const maxPageNumbers = 8

  if (totalPages <= maxPageNumbers) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > delta + 2) pages.push('...')

    const start = Math.max(2, currentPage - delta)
    const end = Math.min(totalPages - 1, currentPage + delta)
    for (let i = start; i <= end; i++) pages.push(i)

    if (currentPage < totalPages - delta - 1) pages.push('...')
    pages.push(totalPages)
  }
  return pages
}

export type PaginationCustomProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export const PaginationCustom: React.FC<PaginationCustomProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page)
    }
  }

  const pageNumbers = getPageNumbers(currentPage, totalPages)
  if (totalPages <= 1) return null

  return (
    <Pagination className={className}>
      <PaginationContent>
        {/* Nút Previous */}
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault()
              handlePageChange(currentPage - 1)
            }}
            className={`cursor-pointer select-none ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
          />
        </PaginationItem>

        {/* Các số trang */}
        {pageNumbers.map((pn, index) => (
          <PaginationItem key={index}>
            {pn === '...' ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  handlePageChange(pn as number)
                }}
                isActive={currentPage === pn}
                className={`cursor-pointer select-none ${currentPage === pn ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'hover:bg-secondary/90 hover:text-secondary-foreground'}`}
              >
                {pn}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        {/* Nút Next */}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault()
              handlePageChange(currentPage + 1)
            }}
            className={`cursor-pointer select-none ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
