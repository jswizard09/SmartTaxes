import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, User, Users, CreditCard, MapPin } from "lucide-react";
import type { UserProfile, InsertUserProfile, FILING_STATUS, DEPENDENT_RELATIONSHIPS, ACCOUNT_TYPES } from "@shared/schema";

interface Dependent {
  firstName: string;
  lastName: string;
  middleName?: string;
  ssn?: string;
  dateOfBirth: string;
  relationship: string;
  isQualifyingChild: boolean;
  isQualifyingRelative: boolean;
}

interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country: string;
}

interface BankAccount {
  routingNumber?: string;
  accountNumber?: string;
  accountType?: "checking" | "savings";
}

const FILING_STATUS_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "married_joint", label: "Married Filing Jointly" },
  { value: "married_separate", label: "Married Filing Separately" },
  { value: "head_of_household", label: "Head of Household" },
  { value: "qualifying_widow", label: "Qualifying Widow(er)" },
];

const DEPENDENT_RELATIONSHIP_OPTIONS = [
  { value: "child", label: "Child" },
  { value: "stepchild", label: "Stepchild" },
  { value: "foster_child", label: "Foster Child" },
  { value: "grandchild", label: "Grandchild" },
  { value: "sibling", label: "Sibling" },
  { value: "parent", label: "Parent" },
  { value: "grandparent", label: "Grandparent" },
  { value: "other_relative", label: "Other Relative" },
  { value: "non_relative", label: "Non-Relative" },
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

export default function Profile() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [address, setAddress] = useState<Address>({ country: "US" });
  const [bankAccount, setBankAccount] = useState<BankAccount>({});

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: InsertUserProfile) => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Profile updated successfully" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const handleEdit = useCallback(() => {
    if (profile) {
      setFormData(profile);
      setAddress(profile.address as Address || { country: "US" });
      setDependents(profile.dependents as Dependent[] || []);
      setBankAccount(profile.bankAccountInfo as BankAccount || {});
    } else {
      // Initialize with default values for new profile
      setFormData({
        filingStatus: "single",
        isVeteran: false,
        isBlind: false,
        isDisabled: false,
        isSpouseBlind: false,
        isSpouseDisabled: false,
        isSpouseVeteran: false,
      });
      setAddress({ country: "US" });
      setDependents([]);
      setBankAccount({});
    }
    setIsEditing(true);
  }, [profile]);

  const handleSave = useCallback(() => {
    const profileData: InsertUserProfile = {
      userId: profile?.userId || "", // This will be set by the API
      ...formData,
      address,
      dependents,
      bankAccountInfo: bankAccount,
    };
    updateProfileMutation.mutate(profileData);
  }, [formData, address, dependents, bankAccount, updateProfileMutation, profile?.userId]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setFormData({});
    setAddress({ country: "US" });
    setDependents([]);
    setBankAccount({});
  }, []);

  const addDependent = useCallback(() => {
    setDependents(prev => [...prev, {
      firstName: "",
      lastName: "",
      middleName: "",
      ssn: "",
      dateOfBirth: "",
      relationship: "child",
      isQualifyingChild: true,
      isQualifyingRelative: false,
    }]);
  }, []);

  const removeDependent = useCallback((index: number) => {
    setDependents(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateDependent = useCallback((index: number, field: keyof Dependent, value: any) => {
    setDependents(prev => prev.map((dep, i) => 
      i === index ? { ...dep, [field]: value } : dep
    ));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Tax Profile</h1>
          <p className="text-lg text-muted-foreground">
            Manage your personal information and filing status for tax calculations.
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button onClick={handleSave} disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={handleEdit}>
              {profile ? "Edit Profile" : "Create Profile"}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="personal">
            <User className="h-4 w-4 mr-2" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="filing">
            <Users className="h-4 w-4 mr-2" />
            Filing Status
          </TabsTrigger>
          <TabsTrigger value="dependents">
            <Users className="h-4 w-4 mr-2" />
            Dependents
          </TabsTrigger>
          <TabsTrigger value="banking">
            <CreditCard className="h-4 w-4 mr-2" />
            Banking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your basic personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={formData.middleName || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, middleName: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ssn">Social Security Number</Label>
                  <Input
                    id="ssn"
                    type="password"
                    value={formData.ssn || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, ssn: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="XXX-XX-XXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  disabled={!isEditing}
                  placeholder="(XXX) XXX-XXXX"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address Information</CardTitle>
              <CardDescription>Your current mailing address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={address.street || ""}
                  onChange={(e) => setAddress(prev => ({ ...prev, street: e.target.value }))}
                  disabled={!isEditing}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={address.city || ""}
                    onChange={(e) => setAddress(prev => ({ ...prev, city: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={address.state || ""}
                    onValueChange={(value) => setAddress(prev => ({ ...prev, state: value }))}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={address.zip || ""}
                    onChange={(e) => setAddress(prev => ({ ...prev, zip: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="filing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Filing Status</CardTitle>
              <CardDescription>Your tax filing status affects your deductions and tax rates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="filingStatus">Filing Status</Label>
                <Select
                  value={formData.filingStatus || "single"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, filingStatus: value }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select filing status" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILING_STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(formData.filingStatus === "married_joint" || formData.filingStatus === "married_separate") && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Spouse Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="spouseFirstName">Spouse First Name</Label>
                        <Input
                          id="spouseFirstName"
                          value={formData.spouseFirstName || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, spouseFirstName: e.target.value }))}
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="spouseMiddleName">Spouse Middle Name</Label>
                        <Input
                          id="spouseMiddleName"
                          value={formData.spouseMiddleName || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, spouseMiddleName: e.target.value }))}
                          disabled={!isEditing}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="spouseLastName">Spouse Last Name</Label>
                        <Input
                          id="spouseLastName"
                          value={formData.spouseLastName || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, spouseLastName: e.target.value }))}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="spouseSsn">Spouse SSN</Label>
                        <Input
                          id="spouseSsn"
                          type="password"
                          value={formData.spouseSsn || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, spouseSsn: e.target.value }))}
                          disabled={!isEditing}
                          placeholder="XXX-XX-XXXX"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="spouseDateOfBirth">Spouse Date of Birth</Label>
                        <Input
                          id="spouseDateOfBirth"
                          type="date"
                          value={formData.spouseDateOfBirth || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, spouseDateOfBirth: e.target.value }))}
                          disabled={!isEditing}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-4">Special Circumstances</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isVeteran"
                        checked={formData.isVeteran || false}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isVeteran: !!checked }))}
                        disabled={!isEditing}
                      />
                      <Label htmlFor="isVeteran">I am a veteran</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isBlind"
                        checked={formData.isBlind || false}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isBlind: !!checked }))}
                        disabled={!isEditing}
                      />
                      <Label htmlFor="isBlind">I am blind</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isDisabled"
                        checked={formData.isDisabled || false}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDisabled: !!checked }))}
                        disabled={!isEditing}
                      />
                      <Label htmlFor="isDisabled">I am disabled</Label>
                    </div>
                  </div>
                  
                  {(formData.filingStatus === "married_joint" || formData.filingStatus === "married_separate") && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isSpouseVeteran"
                          checked={formData.isSpouseVeteran || false}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isSpouseVeteran: !!checked }))}
                          disabled={!isEditing}
                        />
                        <Label htmlFor="isSpouseVeteran">Spouse is a veteran</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isSpouseBlind"
                          checked={formData.isSpouseBlind || false}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isSpouseBlind: !!checked }))}
                          disabled={!isEditing}
                        />
                        <Label htmlFor="isSpouseBlind">Spouse is blind</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isSpouseDisabled"
                          checked={formData.isSpouseDisabled || false}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isSpouseDisabled: !!checked }))}
                          disabled={!isEditing}
                        />
                        <Label htmlFor="isSpouseDisabled">Spouse is disabled</Label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependents" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Dependents</CardTitle>
                  <CardDescription>Add your qualifying dependents for tax benefits</CardDescription>
                </div>
                {isEditing && (
                  <Button onClick={addDependent} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Dependent
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {dependents.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No dependents added yet</p>
                  {isEditing && (
                    <Button onClick={addDependent} className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Dependent
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {dependents.map((dependent, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            Dependent {index + 1}
                          </CardTitle>
                          {isEditing && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeDependent(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>First Name</Label>
                            <Input
                              value={dependent.firstName}
                              onChange={(e) => updateDependent(index, "firstName", e.target.value)}
                              disabled={!isEditing}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Middle Name</Label>
                            <Input
                              value={dependent.middleName || ""}
                              onChange={(e) => updateDependent(index, "middleName", e.target.value)}
                              disabled={!isEditing}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Last Name</Label>
                            <Input
                              value={dependent.lastName}
                              onChange={(e) => updateDependent(index, "lastName", e.target.value)}
                              disabled={!isEditing}
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>SSN (Optional)</Label>
                            <Input
                              type="password"
                              value={dependent.ssn || ""}
                              onChange={(e) => updateDependent(index, "ssn", e.target.value)}
                              disabled={!isEditing}
                              placeholder="XXX-XX-XXXX"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Date of Birth</Label>
                            <Input
                              type="date"
                              value={dependent.dateOfBirth}
                              onChange={(e) => updateDependent(index, "dateOfBirth", e.target.value)}
                              disabled={!isEditing}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Relationship</Label>
                          <Select
                            value={dependent.relationship}
                            onValueChange={(value) => updateDependent(index, "relationship", value)}
                            disabled={!isEditing}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPENDENT_RELATIONSHIP_OPTIONS.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={dependent.isQualifyingChild}
                              onCheckedChange={(checked) => updateDependent(index, "isQualifyingChild", !!checked)}
                              disabled={!isEditing}
                            />
                            <Label>Qualifying Child</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={dependent.isQualifyingRelative}
                              onCheckedChange={(checked) => updateDependent(index, "isQualifyingRelative", !!checked)}
                              disabled={!isEditing}
                            />
                            <Label>Qualifying Relative</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Banking Information</CardTitle>
              <CardDescription>Direct deposit information for refunds (optional)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="routingNumber">Routing Number</Label>
                <Input
                  id="routingNumber"
                  value={bankAccount.routingNumber || ""}
                  onChange={(e) => setBankAccount(prev => ({ ...prev, routingNumber: e.target.value }))}
                  disabled={!isEditing}
                  placeholder="9-digit routing number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  type="password"
                  value={bankAccount.accountNumber || ""}
                  onChange={(e) => setBankAccount(prev => ({ ...prev, accountNumber: e.target.value }))}
                  disabled={!isEditing}
                  placeholder="Account number"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type</Label>
                <Select
                  value={bankAccount.accountType || ""}
                  onValueChange={(value) => setBankAccount(prev => ({ ...prev, accountType: value as "checking" | "savings" }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
