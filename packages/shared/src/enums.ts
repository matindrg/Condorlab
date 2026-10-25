export enum UserRole {
  Student = 'Student',
  ExamOfficer = 'ExamOfficer',
  ContentAdmin = 'ContentAdmin',
  Finance = 'Finance',
  Support = 'Support',
  MasterAdmin = 'MasterAdmin',
  Grandmaster = 'Grandmaster',
}

export enum UserStatus {
  PendingVerification = 'Pending_Verification',
  Active = 'Active',
  Restricted = 'Restricted',
  Suspended = 'Suspended',
  DeletionPending = 'Deletion_Pending',
}

export enum StudentGrade {
  Grade7 = '7',
  Grade8 = '8',
  Grade9 = '9',
  Grade10 = '10',
  Grade11 = '11',
}

export enum ExamStatus {
  Draft = 'Draft',
  Published = 'Published',
  Active = 'Active',
  Closed = 'Closed',
  Archived = 'Archived',
}

export enum ExamCategory {
  All = 'all',
  Stage1 = 'stage1',
  Stage2 = 'stage2',
  Campbell = 'campbell',
  Topical = 'topical',
}

export enum AccessType {
  Official = 'Official',
  Open = 'Open',
}

export enum QuestionTopic {
  Biochemistry = 'Biochemistry',
  CellBiology = 'CellBiology',
  Genetics = 'Genetics',
  PlantPhysiology = 'PlantPhysiology',
  AnimalPhysiology = 'AnimalPhysiology',
  Ethology = 'Ethology',
  Ecology = 'Ecology',
  Evolution = 'Evolution',
}

export enum TicketStatus {
  Open = 'open',
  Pending = 'pending',
  Closed = 'closed',
}
