/**
 * Snowflake ID Generator
 *
 * Generates unique 64-bit IDs using the Snowflake algorithm.
 * Format: 41 bits timestamp + 10 bits machine ID + 12 bits sequence
 *
 * This ensures:
 * - Globally unique IDs across distributed systems
 * - Sortable by time
 * - No collisions within the same millisecond
 */

class SnowflakeGenerator {
  private readonly epoch: number = 1609459200000; // 2021-01-01 00:00:00 UTC (custom epoch)
  private readonly machineIdBits: number = 10;
  private readonly sequenceBits: number = 12;

  private readonly maxMachineId: number = (1 << this.machineIdBits) - 1; // 1023
  private readonly maxSequence: number = (1 << this.sequenceBits) - 1; // 4095

  private readonly machineIdShift: number = this.sequenceBits; // 12
  private readonly timestampShift: number =
    this.sequenceBits + this.machineIdBits; // 22

  private machineId: number;
  private sequence: number = 0;
  private lastTimestamp: number = -1;

  constructor(machineId: number = 1) {
    if (machineId < 0 || machineId > this.maxMachineId) {
      throw new Error(`Machine ID must be between 0 and ${this.maxMachineId}`);
    }
    this.machineId = machineId;
  }

  /**
   * Generate a new Snowflake ID
   * @returns BigInt - 64-bit unique ID
   */
  nextId(): bigint {
    let timestamp = Date.now();

    if (timestamp < this.lastTimestamp) {
      throw new Error(
        `Clock moved backwards. Refusing to generate ID for ${this.lastTimestamp - timestamp} milliseconds`
      );
    }

    if (timestamp === this.lastTimestamp) {
      // Same millisecond, increment sequence
      this.sequence = (this.sequence + 1) & this.maxSequence;
      if (this.sequence === 0) {
        // Sequence overflow, wait for next millisecond
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      // New millisecond, reset sequence
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    // Generate ID: (timestamp - epoch) << 22 | machineId << 12 | sequence
    const id =
      (BigInt(timestamp - this.epoch) << BigInt(this.timestampShift)) |
      (BigInt(this.machineId) << BigInt(this.machineIdShift)) |
      BigInt(this.sequence);

    return id;
  }

  /**
   * Wait until next millisecond
   */
  private waitNextMillis(lastTimestamp: number): number {
    let timestamp = Date.now();
    while (timestamp <= lastTimestamp) {
      timestamp = Date.now();
    }
    return timestamp;
  }

  /**
   * Parse a Snowflake ID to extract its components
   */
  parse(id: bigint): {
    timestamp: number;
    machineId: number;
    sequence: number;
    date: Date;
  } {
    const timestamp = Number(id >> BigInt(this.timestampShift)) + this.epoch;
    const machineId = Number(
      (id >> BigInt(this.machineIdShift)) & BigInt(this.maxMachineId)
    );
    const sequence = Number(id & BigInt(this.maxSequence));

    return {
      timestamp,
      machineId,
      sequence,
      date: new Date(timestamp)
    };
  }
}

// Create a singleton instance
// Machine ID can be configured via environment variable SNOWFLAKE_MACHINE_ID
// Default to 1 for single-server deployments
const machineId = parseInt(process.env.SNOWFLAKE_MACHINE_ID || '1', 10);
export const snowflake = new SnowflakeGenerator(machineId);

/**
 * Generate a new Snowflake ID
 * @returns string - ID as string (for JSON compatibility)
 */
export function generateId(): string {
  return snowflake.nextId().toString();
}

/**
 * Generate a new Snowflake ID as BigInt
 * @returns bigint - 64-bit ID
 */
export function generateIdBigInt(): bigint {
  return snowflake.nextId();
}

/**
 * Parse a Snowflake ID
 */
export function parseId(id: string | bigint) {
  const idBigInt = typeof id === 'string' ? BigInt(id) : id;
  return snowflake.parse(idBigInt);
}
