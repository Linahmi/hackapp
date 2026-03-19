import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

let cache = null

export function getData() {
  if (cache) return cache

  const dataDir = path.join(process.cwd(), 'data')

  const suppliers = parse(
    fs.readFileSync(path.join(dataDir, 'suppliers.csv')),
    { columns: true, skip_empty_lines: true }
  )
  const pricing = parse(
    fs.readFileSync(path.join(dataDir, 'pricing.csv')),
    { columns: true, skip_empty_lines: true }
  )
  const historicalAwards = parse(
    fs.readFileSync(path.join(dataDir, 'historical_awards.csv')),
    { columns: true, skip_empty_lines: true }
  )
  const requests = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'requests.json'))
  )
  const policies = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'policies.json'))
  )

  cache = { suppliers, pricing, historicalAwards, requests, policies }
  return cache
}// placeholder
