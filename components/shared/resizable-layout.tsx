'use client'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ReactNode } from 'react'

interface Props {
  mainContent: ReactNode
  sideContent?: ReactNode
}

export function ResizableLayout({ mainContent, sideContent }: Props) {
  return (
    <div className="flex-1 min-h-0">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel 
          id="main" 
          order={1} 
          defaultSize={sideContent ? 60 : 100}
          minSize={30}
        >
          <div className="h-full overflow-y-auto pl-8">
            <div className="overflow-x-hidden">
              {mainContent}
            </div>
          </div>
        </ResizablePanel>

        {sideContent && (
          <>
            <ResizableHandle />
            <ResizablePanel 
              id="side" 
              order={2} 
              defaultSize={40}
              minSize={20}
            >
              {sideContent}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
} 