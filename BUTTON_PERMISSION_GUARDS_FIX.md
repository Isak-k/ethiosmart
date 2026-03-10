# Button Permission Guards - Complete Fix

## Issues Found

### ❌ CRITICAL: ManageDepartments.tsx - ALL CRUD buttons unprotected
- Add Department button: NO permission guard
- Edit button: NO permission guard  
- Delete button: NO permission guard

### ⚠️ AdminStudents.tsx - Add Student button missing guard
- "Add Student" button at top: NO permission guard at button level

---

## Fixes Required

### 1. AdminStudents.tsx - Add permission guard to "Add Student" button

**Location**: Line ~290

**Before**:
```typescript
<Button onClick={() => setCreateDialogOpen(true)} className="flex-1 sm:flex-none">
  <Plus className="h-4 w-4 mr-2" />
  Add Student
</Button>
```

**After**:
```typescript
{canEdit('students') && (
  <Button onClick={() => setCreateDialogOpen(true)} className="flex-1 sm:flex-none">
    <Plus className="h-4 w-4 mr-2" />
    Add Student
  </Button>
)}
```

---

### 2. ManageDepartments.tsx - Add permission guards to ALL CRUD buttons

**Location**: Multiple locations in the file

**Changes needed**:

#### A. Add Department button (line ~68)
**Before**:
```typescript
<Button>
  <Plus className="h-4 w-4 mr-2" />
  Add Department
</Button>
```

**After**:
```typescript
{canEdit('departments') && (
  <Button>
    <Plus className="h-4 w-4 mr-2" />
    Add Department
  </Button>
)}
```

#### B. Edit button (line ~155)
**Before**:
```typescript
<Button 
  variant="outline" 
  size="sm"
  onClick={() => handleEditClick(dept)}
>
  <Edit className="h-4 w-4" />
</Button>
```

**After**:
```typescript
{canEdit('departments') && (
  <Button 
    variant="outline" 
    size="sm"
    onClick={() => handleEditClick(dept)}
  >
    <Edit className="h-4 w-4" />
  </Button>
)}
```

#### C. Delete button (line ~162)
**Before**:
```typescript
<Button 
  variant="destructive" 
  size="sm"
  onClick={() => handleDeleteClick(dept)}
>
  <Trash2 className="h-4 w-4" />
</Button>
```

**After**:
```typescript
{canDelete('departments') && (
  <Button 
    variant="destructive" 
    size="sm"
    onClick={() => handleDeleteClick(dept)}
  >
    <Trash2 className="h-4 w-4" />
  </Button>
)}
```

---

## Verification Checklist

After applying fixes, verify:

- [ ] AdminStudents.tsx - "Add Student" button only shows when user has `editStudents` permission
- [ ] ManageDepartments.tsx - "Add Department" button only shows when user has `manageDepartments` permission
- [ ] ManageDepartments.tsx - "Edit" button only shows when user has `manageDepartments` permission
- [ ] ManageDepartments.tsx - "Delete" button only shows when user has `manageDepartments` permission
- [ ] Test with examiner who has NO permissions - buttons should be hidden
- [ ] Test with examiner who has permissions - buttons should be visible
- [ ] Backend still blocks unauthorized access (403 Forbidden)

---

## Permission Mapping

| Page | Button | Permission | Type |
|------|--------|-----------|------|
| AdminStudents | Add Student | `editStudents` | Create |
| ManageDepartments | Add Department | `manageDepartments` | Create |
| ManageDepartments | Edit | `manageDepartments` | Update |
| ManageDepartments | Delete | `manageDepartments` | Delete |

---

## Status

- [x] AdminStudents.tsx fixed
- [x] ManageDepartments.tsx fixed
- [ ] Tested with restricted user
- [ ] Tested with full permissions user
- [x] Build passes (no diagnostics)
- [ ] Ready for deployment

---

## Changes Applied

### AdminStudents.tsx
✅ Added permission guard to "Add Student" button:
```typescript
{canEdit('students') && (
  <Button onClick={() => setCreateDialogOpen(true)} className="flex-1 sm:flex-none">
    <Plus className="h-4 w-4 mr-2" />
    Add Student
  </Button>
)}
```

### ManageDepartments.tsx
✅ Added import: `import { useSectionPermissions } from "@/hooks/useSectionPermissions";`
✅ Added hook: `const { canEdit, canDelete } = useSectionPermissions();`
✅ Added permission guard to "Add Department" button
✅ Added permission guard to "Edit" button
✅ Added permission guard to "Delete" button

All buttons now properly check permissions before rendering.

