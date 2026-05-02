import type { Domain } from '../router/domain-router.js';

export type CapabilityName =
  | 'pulse.recall'
  | 'pulse.ingest'
  | 'health.summary'
  | 'calendar.read'
  | 'gmail.read'
  | 'notion.search'
  | 'krisp.lifelog'
  | 'telegram.reply'
  | 'reddit'
  | 'mobile'
  | 'playwright';

export type CapabilityAccess =
  | 'silent'
  | 'read_only'
  | 'confirm_action'
  | 'dev_only'
  | 'disabled_default';

export interface Capability {
  name: CapabilityName;
  domains: Domain[];
  access: CapabilityAccess;
  privacy: 'low' | 'medium' | 'high';
}

export const CAPABILITIES: Capability[] = [
  {
    name: 'pulse.recall',
    domains: ['unknown'],
    access: 'silent',
    privacy: 'medium',
  },
  {
    name: 'pulse.ingest',
    domains: ['unknown'],
    access: 'silent',
    privacy: 'medium',
  },
  {
    name: 'health.summary',
    domains: ['body'],
    access: 'silent',
    privacy: 'high',
  },
  {
    name: 'calendar.read',
    domains: ['external_schedule'],
    access: 'read_only',
    privacy: 'high',
  },
  {
    name: 'gmail.read',
    domains: ['external_schedule'],
    access: 'read_only',
    privacy: 'high',
  },
  {
    name: 'notion.search',
    domains: ['memory_question', 'tasks', 'dev', 'book', 'mila'],
    access: 'read_only',
    privacy: 'medium',
  },
  {
    name: 'krisp.lifelog',
    domains: ['memory_question', 'tasks'],
    access: 'read_only',
    privacy: 'high',
  },
  {
    name: 'telegram.reply',
    domains: ['admin'],
    access: 'confirm_action',
    privacy: 'medium',
  },
  {
    name: 'reddit',
    domains: ['dev'],
    access: 'disabled_default',
    privacy: 'high',
  },
  {
    name: 'mobile',
    domains: ['dev'],
    access: 'dev_only',
    privacy: 'high',
  },
  {
    name: 'playwright',
    domains: ['dev'],
    access: 'dev_only',
    privacy: 'medium',
  },
];
