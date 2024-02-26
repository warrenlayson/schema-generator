#!/usr/bin/env node

const mysql = require('mysql2/promise')
const fs = require('node:fs/promises')
const path = require('node:path')
require('dotenv').config()

async function getColumnsForTable(connection,tableName) {
    return connection.query(`SHOW FULL COLUMNS FROM ${tableName}`).then(([results]) => {
        return results
    })
}

async function getTableNames(connection) {
    return connection.query('SHOW TABLES').then(([results]) => {
        return results.map(result => Object.values(result)[0])
    })
}

function getColumnType(dataType, nullable ) {
    let type = null;
    if (dataType === "text" || dataType.includes("varchar") || dataType === "datetime") {
        type = "string"
    }
    
    if (dataType.includes("int") || dataType.includes("tinyint")) {
        type = "number"
    }
    
    if (nullable === "YES") {
        type = [type, "null"]
    }
    
    return type
    
}

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error('Database URL required')
    }
    
    const connection = await mysql.createConnection({
        uri: process.env.DATABASE_URL
    })
    
    const tableNames = await getTableNames(connection)
    
    const schemas = []
    for (const tableName of tableNames) {
        
        if (tableName.startsWith("_")) {
            continue
        }
        
        const columns = await getColumnsForTable(connection,tableName)
        const formattedColumns = {}
        for (const column of columns) {
            formattedColumns[column.Field] = {
                default: column.Default,
                description: column.Comment,
                type: getColumnType(column.Type, column.Null),
                acl: {},
                collections: {},
                validation: [],
                api_alias: ""
            }
        }
        
        const schema = {
            title: toTitleCase(tableName),
            table_name: tableName,
            description: "",
            type: "object",
            properties: formattedColumns
        }
        
        schemas.push(schema)
    }
    
    await writeOutput(schemas)
}

async function writeOutput(schemas) {
    const outputPath = path.join(process.cwd(), 'out')
    for (const schema of schemas) {
        const filename = `${schema.table_name}.json`
        await fs.writeFile(path.join(outputPath, filename), JSON.stringify(schema, null, 2), 'utf-8')
    }
}

function toTitleCase(string) {
    return string.split("_").map(a => a[0].toUpperCase() + a.slice(1)).join(" ")
}

main()
.then(() => {
    console.log("Introspect complete. Please review in the out directory")
    process.exit(0)
})
.catch(error => {
    if (error) {
        console.error(error)
        process.exit(1)
    }
})
