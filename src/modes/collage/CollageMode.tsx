import { CollageStage } from './CollageStage'
import './collage.css'

export function CollageMode() {
  return (
    <div className="collage">
      <main className="collage-stage">
        <CollageStage />
      </main>
    </div>
  )
}
