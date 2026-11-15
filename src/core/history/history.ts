/** Линейная история состояний с ограничением по длине. Состояния считаются неизменяемыми. */
export class History<T> {
  private states: T[]
  private index = 0

  constructor(
    initial: T,
    private readonly limit = 100,
  ) {
    this.states = [initial]
  }

  get current(): T {
    return this.states[this.index]
  }
  get canUndo(): boolean {
    return this.index > 0
  }
  get canRedo(): boolean {
    return this.index < this.states.length - 1
  }

  push(state: T): void {
    this.states = [...this.states.slice(0, this.index + 1), state]
    if (this.states.length > this.limit) this.states.splice(0, this.states.length - this.limit)
    this.index = this.states.length - 1
  }

  undo(): T | null {
    if (!this.canUndo) return null
    this.index--
    return this.current
  }

  redo(): T | null {
    if (!this.canRedo) return null
    this.index++
    return this.current
  }
}
