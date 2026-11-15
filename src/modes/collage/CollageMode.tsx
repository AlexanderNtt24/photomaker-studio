import { CollageStage } from './CollageStage'
import { Inspector } from './Inspector'
import './collage.css'

export function CollageMode() {
  return (
    <div className="collage">
      <div className="collage-body">
        <main className="collage-stage">
          <CollageStage />
        </main>
        <Inspector />
      </div>
    </div>
  )
}
