import { storage } from '@forge/api';

export class PTODatabase {
  constructor() {
    this.tables = Object.keys(PTO_SCHEMA);
  }

  // Initialize database
  async initialize() {
    for (const table of this.tables) {
      const existing = await storage.get(table);
      if (!existing) {
        await storage.set(table, []);
        console.log(`✅ Created PTO table: ${table}`);
      }
    }
    
    await storage.set('pto_db_initialized', {
      initialized: true,
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  }

  // Generic CRUD operations
  async create(table, data) {
    const records = await storage.get(table) || [];
    const newRecord = {
      id: `${table}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    records.push(newRecord);
    await storage.set(table, records);
    return newRecord;
  }

  async findById(table, id) {
    const records = await storage.get(table) || [];
    return records.find(record => record.id === id);
  }

  async findByField(table, field, value) {
    const records = await storage.get(table) || [];
    return records.filter(record => record[field] === value);
  }

  async update(table, id, updates) {
    const records = await storage.get(table) || [];
    const index = records.findIndex(record => record.id === id);
    
    if (index === -1) {
      throw new Error(`Record with id ${id} not found in ${table}`);
    }
    
    records[index] = {
      ...records[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    await storage.set(table, records);
    return records[index];
  }

  async delete(table, id) {
    const records = await storage.get(table) || [];
    const filtered = records.filter(record => record.id !== id);
    await storage.set(table, filtered);
    return true;
  }

  async findAll(table, filters = {}) {
    const records = await storage.get(table) || [];
    
    if (Object.keys(filters).length === 0) {
      return records;
    }
    
    return records.filter(record => {
      return Object.entries(filters).every(([key, value]) => {
        if (Array.isArray(value)) {
          return value.includes(record[key]);
        }
        return record[key] === value;
      });
    });
  }

  async overwriteTable(table, records) {
    await storage.set(table, records);
    return true;
  }
}
