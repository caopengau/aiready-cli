/**
 * DynamoDB UpdateExpression builder utility.
 * Eliminates manual expression string concatenation and reduces duplication.
 */

export class UpdateBuilder {
  private updates: string[] = [];
  private attributeValues: Record<string, unknown> = {};
  private attributeNames: Record<string, string> = {};
  private valueCounter = 0;

  /**
   * Add an unconditional SET clause.
   * @param attributeName The DynamoDB attribute name
   * @param value The value to set
   * @param customName Optional custom expression attribute name (for reserved words)
   */
  set(attributeName: string, value: unknown, customName?: string): this {
    const valuePlaceholder = `:val${this.valueCounter++}`;
    this.attributeValues[valuePlaceholder] = value;

    if (customName) {
      const namePlaceholder = `#${customName}`;
      this.attributeNames[namePlaceholder] = attributeName;
      this.updates.push(`${namePlaceholder} = ${valuePlaceholder}`);
    } else {
      this.updates.push(`${attributeName} = ${valuePlaceholder}`);
    }

    return this;
  }

  /**
   * Add a conditional SET clause (only if value is not undefined).
   * @param attributeName The DynamoDB attribute name
   * @param value The value to set (skipped if undefined)
   */
  setIf(attributeName: string, value: unknown): this {
    if (value !== undefined) {
      this.set(attributeName, value);
    }
    return this;
  }

  /**
   * Add an ADD clause for numeric or set operations.
   * @param attributeName The attribute name
   * @param value The value to add
   */
  add(attributeName: string, value: unknown): this {
    const valuePlaceholder = `:val${this.valueCounter++}`;
    this.attributeValues[valuePlaceholder] = value;
    this.updates.push(`${attributeName} ADD ${valuePlaceholder}`);
    return this;
  }

  /**
   * Add a REMOVE clause.
   * @param attributeName The attribute name
   */
  remove(attributeName: string): this {
    this.updates.push(`REMOVE ${attributeName}`);
    return this;
  }

  /**
   * Build the final UpdateExpression and ExpressionAttributeValues.
   */
  build() {
    if (this.updates.length === 0) {
      throw new Error('UpdateBuilder: No updates specified');
    }

    return {
      UpdateExpression: this.updates.join(', '),
      ExpressionAttributeValues:
        Object.keys(this.attributeValues).length > 0
          ? this.attributeValues
          : undefined,
      ExpressionAttributeNames:
        Object.keys(this.attributeNames).length > 0
          ? this.attributeNames
          : undefined,
    };
  }
}
