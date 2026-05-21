import type {
  CreateProjectSpaceInput,
  ProjectAlias,
  ProjectAliasType,
  ProjectSpace,
  UpdateProjectSpaceInput
} from '@/env'

export function listProjectSpaces(): Promise<ProjectSpace[]> {
  return window.electronAPI.listProjectSpaces()
}

export function getProjectSpace(id: number): Promise<ProjectSpace | null> {
  return window.electronAPI.getProjectSpace(id)
}

export function createProjectSpace(input: CreateProjectSpaceInput): Promise<ProjectSpace> {
  return window.electronAPI.createProjectSpace(input)
}

export function updateProjectSpace(
  id: number,
  patch: UpdateProjectSpaceInput
): Promise<ProjectSpace | null> {
  return window.electronAPI.updateProjectSpace(id, patch)
}

export function deleteProjectSpace(id: number): Promise<boolean> {
  return window.electronAPI.deleteProjectSpace(id)
}

export function listProjectAliases(projectId: number): Promise<ProjectAlias[]> {
  return window.electronAPI.listProjectAliases(projectId)
}

export function replaceProjectAliases(
  projectId: number,
  aliases: Array<{ aliasType: ProjectAliasType; value: string; alias?: string }>
): Promise<ProjectAlias[]> {
  return window.electronAPI.replaceProjectAliases(projectId, aliases)
}
